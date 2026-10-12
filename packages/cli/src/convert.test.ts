import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PdfFonts } from '@spec/core'
import { convertFile } from './convert'

const CORPUS = join(__dirname, '../../../test-corpus')
const FONT_DIR = join(__dirname, '../../../assets/fonts/courier-prime')

const fonts: PdfFonts = {
  regular: readFileSync(join(FONT_DIR, 'CourierPrime-Regular.ttf')),
  bold: readFileSync(join(FONT_DIR, 'CourierPrime-Bold.ttf')),
  italic: readFileSync(join(FONT_DIR, 'CourierPrime-Italic.ttf')),
  boldItalic: readFileSync(join(FONT_DIR, 'CourierPrime-BoldItalic.ttf'))
}

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'spec-cli-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('convertFile', () => {
  const kitchenSink = join(CORPUS, 'fountain/scripts/kitchen-sink.fountain')

  it('converts fountain to pdf', async () => {
    const out = join(dir, 'out.pdf')
    await convertFile(kitchenSink, out, { fonts })
    const bytes = await readFile(out)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('converts fountain to fdx and back', async () => {
    const fdxOut = join(dir, 'out.fdx')
    await convertFile(kitchenSink, fdxOut, { fonts })
    const xml = await readFile(fdxOut, 'utf8')
    expect(xml).toContain('<FinalDraft')

    const fountainOut = join(dir, 'back.fountain')
    await convertFile(fdxOut, fountainOut, { fonts })
    const text = await readFile(fountainOut, 'utf8')
    expect(text).toContain('INT. TEST KITCHEN - DAY')
  })

  it('converts the real Big Fish fdx to fountain', async () => {
    const out = join(dir, 'bigfish.fountain')
    await convertFile(join(CORPUS, 'fdx/Big Fish.fdx'), out, { fonts })
    const text = await readFile(out, 'utf8')
    expect(text).toContain('EXT.')
  })

  it('rejects unsupported extensions', async () => {
    await expect(convertFile('in.docx', 'out.pdf', { fonts })).rejects.toThrow(/Cannot read/)
    await expect(convertFile(kitchenSink, 'out.docx', { fonts })).rejects.toThrow(/Cannot write/)
  })
})
