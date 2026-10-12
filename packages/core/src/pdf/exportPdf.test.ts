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

  it('exports Big Fish at feature length', async () => {
    const source = readFileSync(join(CORPUS, 'spec-samples/Big Fish.fountain'), 'utf8')
    const script = parseFountain(source, { idGenerator: sequentialIdGenerator() })
    const bytes = await exportPdf(script, { fonts: loadFonts() })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(paginate(script).length + 1)
  }, 60_000)
})
