import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { importPdf } from './pdf'

const CORPUS = join(__dirname, '../../../../test-corpus')

describe('importPdf', () => {
  it('imports the Big Fish text-layer PDF with sane structure', async () => {
    const data = readFileSync(join(CORPUS, 'pdf/Big Fish.pdf'))
    const { script } = await importPdf(data, { idGenerator: sequentialIdGenerator() })
    const original = parseFountain(
      readFileSync(join(CORPUS, 'fountain/spec-samples/Big Fish.fountain'), 'utf8'),
      { idGenerator: sequentialIdGenerator() }
    )

    const headings = script.elements.filter((e) => e.type === 'scene_heading').length
    const originalHeadings = original.elements.filter((e) => e.type === 'scene_heading').length
    // The corpus PDF is a plain text print of the Fountain file, so headings
    // keep their INT/EXT shape and should nearly all be found.
    expect(headings).toBeGreaterThanOrEqual(originalHeadings * 0.9)
    expect(headings).toBeLessThanOrEqual(originalHeadings * 1.1)

    const cues = script.elements.filter((e) => e.type === 'character').length
    const originalCues = original.elements.filter((e) => e.type === 'character').length
    expect(cues).toBeGreaterThanOrEqual(originalCues * 0.8)
  }, 120_000)

  it('rejects a PDF without a text layer with a clear error', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([612, 792]) // a blank page: no text at all
    const bytes = await doc.save()
    await expect(importPdf(bytes)).rejects.toThrow(/no usable text layer/)
  }, 30_000)

  it('rejects data that is not a PDF', async () => {
    await expect(importPdf(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/Could not read/)
  })
})
