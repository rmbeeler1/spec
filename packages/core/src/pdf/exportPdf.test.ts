import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { paginate } from '../pagination/paginate'
import { exportPdf, type PdfFonts } from './exportPdf'

const FONT_DIR = join(__dirname, '../../../../assets/fonts/courier-prime')
const CORPUS = join(__dirname, '../../../../test-corpus/fountain')

function loadFonts(): PdfFonts {
  return {
    regular: readFileSync(join(FONT_DIR, 'CourierPrime-Regular.ttf')),
    bold: readFileSync(join(FONT_DIR, 'CourierPrime-Bold.ttf')),
    italic: readFileSync(join(FONT_DIR, 'CourierPrime-Italic.ttf')),
    boldItalic: readFileSync(join(FONT_DIR, 'CourierPrime-BoldItalic.ttf'))
  }
}

describe('exportPdf', () => {
  it('produces a loadable PDF with the right page count', async () => {
    const source = readFileSync(join(CORPUS, 'scripts/kitchen-sink.fountain'), 'utf8')
    const script = parseFountain(source, { idGenerator: sequentialIdGenerator() })
    const bytes = await exportPdf(script, { fonts: loadFonts() })
    expect(bytes.length).toBeGreaterThan(10_000)

    const doc = await PDFDocument.load(bytes)
    const scriptPages = paginate(script).length
    // kitchen-sink has a title page, so expect one extra PDF page
    expect(doc.getPageCount()).toBe(scriptPages + 1)
  }, 30_000)

  it('prints revision asterisks, scene numbers and locked page labels', async () => {
    const filler = Array.from({ length: 60 }, (_, i) => `Filler line ${i} to span pages.`).join(
      '\n\n'
    )
    const script = parseFountain(`INT. KITCHEN - DAY #1#\n\n${filler}\n\nEXT. YARD - DAY #2#\n\nShe digs.\n`, {
      idGenerator: sequentialIdGenerator()
    })
    const revised = script.elements.find((e) => e.text === 'She digs.')!
    const anchors = (await import('../pagination/paginate')).lockPages(script)
    // Insert a page of material after the heading so an A-page appears
    const insertAt = 1
    const extra = Array.from({ length: 56 }, (_, i) => ({
      id: `x${i}`,
      type: 'action' as const,
      text: `Inserted line ${i} pushing the lock into overflow pages.`
    }))
    const edited = {
      titlePage: script.titlePage,
      elements: [
        ...script.elements.slice(0, insertAt),
        ...extra,
        ...script.elements.slice(insertAt)
      ]
    }
    const bytes = await exportPdf(edited, {
      fonts: loadFonts(),
      revisedElementIds: new Set([revised.id]),
      lockedAnchors: anchors
    })

    // Read the PDF back and check what actually printed
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
    let all = ''
    const pageTexts: string[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent()
      const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ')
      pageTexts.push(text)
      all += text + '\n'
    }
    expect(all).toContain('1A.') // an A-page label printed
    expect(all).toContain('2.') // the locked page kept its number
    const revisedPage = pageTexts.find((t) => t.includes('She digs.'))!
    expect(revisedPage).toContain('*') // the margin asterisk
    const numberedPage = pageTexts.find((t) => t.includes('EXT. YARD'))!
    expect(numberedPage).toContain('2') // scene number in the margins
  }, 60_000)

  it('exports Big Fish at feature length', async () => {
    const source = readFileSync(join(CORPUS, 'spec-samples/Big Fish.fountain'), 'utf8')
    const script = parseFountain(source, { idGenerator: sequentialIdGenerator() })
    const bytes = await exportPdf(script, { fonts: loadFonts() })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(paginate(script).length + 1)
  }, 60_000)
})
