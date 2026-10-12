import { PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Script } from '../model/types'
import { paginate, type RenderLine } from '../pagination/paginate'
import type { PaginationConfig } from '../pagination/config'

/**
 * Font bytes are passed in by the caller (the app or the CLI reads the
 * bundled Courier Prime files). Core stays free of filesystem access.
 */
export interface PdfFonts {
  regular: Uint8Array
  bold: Uint8Array
  italic: Uint8Array
  boldItalic: Uint8Array
}

export interface PdfExportOptions {
  fonts: PdfFonts
  pagination?: Partial<PaginationConfig>
}

// US Letter at 72 points per inch. Courier 12pt: 10 chars per inch wide,
// 6 lines per inch tall.
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const LEFT_MARGIN = 108 // 1.5"
const RIGHT_MARGIN = 72 // 1.0"
const TOP_MARGIN = 72 // 1.0"
const CHAR_WIDTH = 7.2
const LINE_HEIGHT = 12
const FONT_SIZE = 12

export async function exportPdf(script: Script, options: PdfExportOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = {
    regular: await doc.embedFont(options.fonts.regular),
    bold: await doc.embedFont(options.fonts.bold),
    italic: await doc.embedFont(options.fonts.italic),
    boldItalic: await doc.embedFont(options.fonts.boldItalic)
  }

  if (script.titlePage.length > 0) {
    drawTitlePage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), script, fonts.regular)
  }

  const pages = paginate(script, options.pagination)
  for (let p = 0; p < pages.length; p++) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    // Page numbers start at 2, top right, per standard practice
    if (p > 0) {
      const label = `${p + 1}.`
      page.drawText(label, {
        x: PAGE_WIDTH - RIGHT_MARGIN - label.length * CHAR_WIDTH,
        y: PAGE_HEIGHT - 48,
        size: FONT_SIZE,
        font: fonts.regular
      })
    }
    for (let n = 0; n < pages[p]!.lines.length; n++) {
      drawLine(page, pages[p]!.lines[n]!, n, fonts)
    }
  }

  return doc.save()
}

function baselineY(lineIndex: number): number {
  return PAGE_HEIGHT - TOP_MARGIN - LINE_HEIGHT * (lineIndex + 1) + 2
}

function drawLine(
  page: PDFPage,
  line: RenderLine,
  lineIndex: number,
  fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont }
): void {
  if (line.type === 'blank' || line.text.length === 0) return
  const y = baselineY(lineIndex)
  const startX = LEFT_MARGIN + line.indent * CHAR_WIDTH

  if (line.spans.length === 0) {
    page.drawText(line.text, { x: startX, y, size: FONT_SIZE, font: fonts.regular })
    return
  }

  // Draw styled runs char-range by char-range
  const boundaries = new Set<number>([0, line.text.length])
  for (const s of line.spans) {
    boundaries.add(Math.max(0, Math.min(line.text.length, s.start)))
    boundaries.add(Math.max(0, Math.min(line.text.length, s.end)))
  }
  const points = [...boundaries].sort((a, b) => a - b)
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const run = line.text.slice(a, b)
    if (run.length === 0) continue
    const span = line.spans.find((s) => s.start <= a && s.end >= b)
    const font = span
      ? span.bold && span.italic
        ? fonts.boldItalic
        : span.bold
          ? fonts.bold
          : span.italic
            ? fonts.italic
            : fonts.regular
      : fonts.regular
    const x = startX + a * CHAR_WIDTH
    page.drawText(run, { x, y, size: FONT_SIZE, font })
    if (span?.underline) {
      page.drawLine({
        start: { x, y: y - 1.5 },
        end: { x: x + run.length * CHAR_WIDTH, y: y - 1.5 },
        thickness: 0.8
      })
    }
  }
}

function drawTitlePage(page: PDFPage, script: Script, font: PDFFont): void {
  const get = (key: string): string[] =>
    script.titlePage.find((e) => e.key.toLowerCase() === key.toLowerCase())?.values ?? []

  const centered: string[] = []
  const title = get('Title')
  if (title.length > 0) centered.push(...title.map((t) => stripMarkers(t)), '')
  const credit = get('Credit')
  if (credit.length > 0) centered.push(...credit, '')
  centered.push(...get('Author'), ...get('Authors'))
  const source = get('Source')
  if (source.length > 0) centered.push('', ...source)

  let lineIndex = 16 // title block starts about a third down the page
  for (const text of centered) {
    if (text.length > 0) {
      const x = LEFT_MARGIN + Math.max(0, Math.floor((60 - text.length) / 2)) * CHAR_WIDTH
      page.drawText(text, { x, y: baselineY(lineIndex), size: FONT_SIZE, font })
    }
    lineIndex++
  }

  // Contact block bottom left, draft date bottom right
  const contact = [...get('Contact'), ...get('Copyright')]
  let y = 144
  for (const text of contact.slice().reverse()) {
    page.drawText(text, { x: LEFT_MARGIN, y, size: FONT_SIZE, font })
    y += LINE_HEIGHT
  }
  const draft = [...get('Draft date'), ...get('Date')]
  y = 144
  for (const text of draft.slice().reverse()) {
    page.drawText(text, {
      x: PAGE_WIDTH - RIGHT_MARGIN - text.length * CHAR_WIDTH,
      y,
      size: FONT_SIZE,
      font
    })
    y += LINE_HEIGHT
  }
}

/** Title page values can carry emphasis markers; render them plain. */
function stripMarkers(s: string): string {
  return s.replace(/\*+/g, '').replace(/_/g, '')
}
