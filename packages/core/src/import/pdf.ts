import type { IdGenerator } from '../model/ids'
import type { TitlePageEntry } from '../model/types'
import { classifyLines, type ImportLine } from './classifier'
import { buildScript, extractFdTitlePage, extractTitlePage } from './build'
import type { ImportResult } from './text'

/**
 * pdf.js is loaded lazily: it is the heaviest dependency in core and only
 * needed when someone actually imports a PDF, so bundlers can split it out.
 *
 * In a browser, pdf.js normally insists on a Web Worker (and throws
 * "No GlobalWorkerOptions.workerSrc specified" without one). Registering the
 * worker module on globalThis.pdfjsWorker BEFORE the first getDocument call
 * makes pdf.js use its built-in main-thread handler instead, in every
 * environment: Node, Electron renderer, dev server, packaged file:// app.
 */
async function loadPdfjs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
  const globals = globalThis as { pdfjsWorker?: unknown }
  if (!globals.pdfjsWorker) {
    // @ts-expect-error -- the worker entry ships no type declarations; we
    // only hand the module object to pdf.js, which reads WorkerMessageHandler
    globals.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  }
  return import('pdfjs-dist/legacy/build/pdf.mjs')
}

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
  const { getDocument } = await loadPdfjs()
  // pdfjs insists on a plain Uint8Array (a Node Buffer is rejected), and it
  // takes ownership of the bytes, so always hand it a fresh copy.
  const task = getDocument({ data: new Uint8Array(data), useSystemFonts: true })
  let doc
  try {
    doc = await task.promise
  } catch {
    throw new Error('Could not read this file as a PDF')
  }

  const pages: Array<Array<{ text: string; x: number }>> = []
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

    const pageLines: Array<{ text: string; x: number }> = []
    const ys = [...byLine.keys()].sort((a, b) => b - a)
    let lastY: number | null = null
    for (const y of ys) {
      const parts = byLine.get(y)!.sort((a, b) => a.x - b.x)
      const text = parts.map((p) => p.str).join(' ').replace(/\s+/g, ' ').trimEnd()
      if (text.trim() === '') continue
      const x = parts[0]!.x
      minX = Math.min(minX, x)
      // A vertical gap of more than ~1.5 line heights means a blank line
      if (lastY !== null && lastY - y > 18) pageLines.push({ text: '', x: 0 })
      pageLines.push({ text, x })
      lastY = y
    }
    pages.push(stripPageFurniture(pageLines))
  }
  await task.destroy()

  // Final Draft style title page: centered lines on page one, no key:value
  // pairs. Route real values to the title page, drop template placeholders.
  let fdTitlePage: TitlePageEntry[] | null = null
  if (pages.length > 1) {
    fdTitlePage = extractFdTitlePage(pages[0]!.map((l) => l.text))
    if (fdTitlePage !== null) pages.shift()
  }

  const rawLines: Array<{ text: string; x: number }> = []
  for (const pageLines of pages) {
    rawLines.push(...pageLines)
    rawLines.push({ text: '', x: 0 }) // page boundary acts as a blank line
  }

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
  return {
    script: buildScript(classified, fdTitlePage ?? titlePage, options.idGenerator),
    lines: classified
  }
}

/**
 * Printed-page furniture is not script content: a standalone page number
 * ("2." top right, sometimes "Page 2") at the very top or bottom of a page
 * is dropped before classification.
 */
const PAGE_NUMBER_RE = /^\s*(page\s+)?\d{1,3}\.?\s*$/i

function stripPageFurniture(
  pageLines: Array<{ text: string; x: number }>
): Array<{ text: string; x: number }> {
  const lines = [...pageLines]
  const firstContent = lines.findIndex((l) => l.text.trim() !== '')
  if (firstContent !== -1 && PAGE_NUMBER_RE.test(lines[firstContent]!.text)) {
    lines.splice(firstContent, 1)
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = lines[i]!.text.trim()
    if (text === '') continue
    if (PAGE_NUMBER_RE.test(text)) lines.splice(i, 1)
    break
  }
  return lines
}
