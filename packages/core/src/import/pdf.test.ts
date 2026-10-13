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

  // Owner's real import, added to the corpus Oct 12, 2026 after three
  // confident misreads. Each assertion below is one of them.
  it('imports the zombie short: merged paragraphs, no page numbers, no template placeholders', async () => {
    const data = readFileSync(join(CORPUS, 'pdf/Untitled Zombie Shortfilm.pdf'))
    const { script } = await importPdf(data, { idGenerator: sequentialIdGenerator() })

    // (1) Wrapped action lines merge into one flowing paragraph
    const firstAction = script.elements.find((e) => e.type === 'action')
    expect(firstAction).toBeDefined()
    expect(firstAction!.text).not.toContain('\n')
    expect(firstAction!.text).toContain('The door is barricaded.')
    expect(firstAction!.text).toContain('sits on a barrel holding a pistol')

    // (2) Page numbers like "2." never become elements
    const pageNumbers = script.elements.filter((e) => /^\d{1,3}\.?$/.test(e.text.trim()))
    expect(pageNumbers).toEqual([])

    // (3) Final Draft template placeholders are gone: not in the body and
    // not on the title page (every field in this PDF is an unfilled
    // placeholder, so the title page comes out empty)
    const body = script.elements.map((e) => e.text).join('\n')
    expect(body).not.toContain('Name of Project')
    expect(body).not.toContain('Name of First Writer')
    expect(body).not.toContain('Phone Number')
    expect(script.titlePage).toEqual([])

    // (4) Page-break speech furniture is repaired: no (MORE) lines remain,
    // and Scott's split speech is one dialogue element again
    expect(script.elements.some((e) => /^\(\s*MORE\s*\)$/i.test(e.text.trim()))).toBe(false)
    const idx = script.elements.findIndex(
      (e) => e.type === 'dialogue' && e.text.includes('No refugee center.')
    )
    expect(idx).toBeGreaterThan(-1)
    // The speech continues through its (beat) with no repeated cue between:
    // dialogue, parenthetical, dialogue, all one speech again
    expect(script.elements[idx + 1]).toMatchObject({ type: 'parenthetical', text: '(beat)' })
    expect(script.elements[idx + 2]!.type).toBe('dialogue')
    expect(script.elements[idx + 2]!.text).toContain('Help isn’t coming.')
    // Real mid-page (CONT'D) cues survive (they are legitimate cues)
    const contdCues = script.elements.filter(
      (e) => e.type === 'character' && /\(cont[’']d\)/i.test(e.text)
    )
    expect(contdCues.length).toBeGreaterThan(0)

    // The script itself still came through
    expect(script.elements[0]).toMatchObject({ type: 'scene_heading', text: 'INT. BASEMENT - DAY' })
    const cues = script.elements.filter((e) => e.type === 'character').length
    expect(cues).toBeGreaterThan(80)
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
