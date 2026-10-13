import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { IdGenerator } from '../model/ids'
import { classifyLines, type ImportLine } from './classifier'
import { buildScript, extractTitlePage } from './build'
import type { ImportResult } from './text'

/**
 * Best-effort import of a PDF's text layer. Text items come with x/y
 * positions; items sharing a baseline become one line, ordered left to
 * right, and the x offset becomes an indent hint for the classifier.
 * Scanned PDFs (no text layer) raise a clear error instead of importing
 * garbage.
 */
export async function importPdf(
  data: Uint8Array,
  options: { idGenerator?: IdGenerator } = {}
): Promise<ImportResult> {
  // pdfjs insists on a plain Uint8Array (a Node Buffer is rejected), and it
  // takes ownership of the bytes, so always hand it a fresh copy.
  const task = getDocument({ data: new Uint8Array(data), useSystemFonts: true })
  let doc
  try {
    doc = await task.promise
  } catch {
    throw new Error('Could not read this file as a PDF')
  }

  const rawLines: Array<{ text: string; x: number }> = []
  let minX = Number.POSITIVE_INFINITY
  let maxWidth = 0

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    maxWidth = Math.max(maxWidth, page.view[2]! - page.view[0]!)
    const content = await page.getTextContent()

    // Group items by baseline y (rounded), top of page first
    const byLine = new Map<number, Array<{ x: number; str: string }>>()
    for (const item of content.items) {
      if (!('str' in item) || item.str.length === 0) continue
      const x = item.transform[4] as number
      const y = Math.round(item.transform[5] as number)
      let bucket = byLine.get(y)
      // Tolerate 1pt of baseline wobble
      if (!bucket) {
        for (const [key, value] of byLine) {
          if (Math.abs(key - y) <= 1) {
            bucket = value
            break
          }
        }
      }
      if (!bucket) {
        bucket = []
        byLine.set(y, bucket)
      }
      bucket.push({ x, str: item.str })
    }

    const ys = [...byLine.keys()].sort((a, b) => b - a)
    let lastY: number | null = null
    for (const y of ys) {
      const parts = byLine.get(y)!.sort((a, b) => a.x - b.x)
      const text = parts.map((p) => p.str).join(' ').replace(/\s+/g, ' ').trimEnd()
      if (text.trim() === '') continue
      const x = parts[0]!.x
      minX = Math.min(minX, x)
      // A vertical gap of more than ~1.5 line heights means a blank line
      if (lastY !== null && lastY - y > 18) rawLines.push({ text: '', x: 0 })
      rawLines.push({ text, x })
      lastY = y
    }
    rawLines.push({ text: '', x: 0 }) // page boundary acts as a blank line
  }
  await task.destroy()

  const totalChars = rawLines.reduce((n, l) => n + l.text.length, 0)
  if (totalChars < 40) {
    throw new Error(
      'This PDF has no usable text layer (it is probably a scan). Run OCR on it first, then import the result.'
    )
  }

  const usable = Math.max(1, maxWidth - minX - 72) // minus a right margin
  const importLines: ImportLine[] = rawLines.map((l) =>
    l.text === ''
      ? { text: '' }
      : { text: l.text, indent: Math.max(0, Math.min(1, (l.x - minX) / usable)) }
  )

  const { titlePage, rest } = extractTitlePage(importLines.map((l) => l.text))
  const trimmed = importLines.slice(importLines.length - rest.length)
  const classified = classifyLines(trimmed)
  return { script: buildScript(classified, titlePage, options.idGenerator), lines: classified }
}
