import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import type { Script } from '../model/types'
import { readFdx } from './read'
import { writeFdx } from './write'

const BIG_FISH_FDX = join(__dirname, '../../../../test-corpus/fdx/Big Fish.fdx')
const BIG_FISH_FOUNTAIN = join(
  __dirname,
  '../../../../test-corpus/fountain/spec-samples/Big Fish.fountain'
)

describe('readFdx on Big Fish', () => {
  const script = readFdx(readFileSync(BIG_FISH_FDX, 'utf8'), {
    idGenerator: sequentialIdGenerator()
  })

  it('reads the whole script', () => {
    expect(script.elements.length).toBeGreaterThan(1000)
  })

  it('element type counts match a snapshot', () => {
    const counts: Record<string, number> = {}
    for (const el of script.elements) counts[el.type] = (counts[el.type] ?? 0) + 1
    expect(counts).toMatchSnapshot()
  })

  it('scene heading count is close to the Fountain version', () => {
    const fountain = parseFountain(readFileSync(BIG_FISH_FOUNTAIN, 'utf8'), {
      idGenerator: sequentialIdGenerator()
    })
    const headings = (s: Script) => s.elements.filter((e) => e.type === 'scene_heading').length
    const a = headings(script)
    const b = headings(fountain)
    expect(Math.abs(a - b)).toBeLessThanOrEqual(3)
  })

  it('rejects non-FDX input', () => {
    expect(() => readFdx('<html></html>')).toThrow(/Not an FDX file/)
  })
})

describe('FDX round-trip: write then read', () => {
  const script: Script = {
    titlePage: [{ key: 'Title', values: ['Round Trip'] }],
    elements: [
      { id: 'a1', type: 'scene_heading', text: 'INT. LAB - NIGHT', sceneNumber: '1A' },
      { id: 'a2', type: 'action', text: 'A centrifuge spins. **Bold** and *italic* and _underlined_ text.' },
      { id: 'a3', type: 'character', text: 'DR. OKONKWO' },
      { id: 'a4', type: 'parenthetical', text: '(whispering)' },
      { id: 'a5', type: 'dialogue', text: 'The samples are switched & nobody noticed <yet>.' },
      { id: 'a6', type: 'character', text: 'ASSISTANT' },
      { id: 'a7', type: 'dialogue', text: 'Left side of a dual block.' },
      { id: 'a8', type: 'character', text: 'INTERN', dual: true },
      { id: 'a9', type: 'dialogue', text: 'Right side of a dual block.' },
      { id: 'a10', type: 'centered', text: 'THE END' },
      { id: 'a11', type: 'transition', text: 'CUT TO:' },
      { id: 'a12', type: 'section', text: 'Act One', depth: 1 },
      { id: 'a13', type: 'synopsis', text: 'Not exported to FDX' }
    ]
  }

  const xml = writeFdx(script)
  const back = readFdx(xml, { idGenerator: sequentialIdGenerator() })

  it('is valid enough to read back', () => {
    expect(back.elements.length).toBeGreaterThan(0)
  })

  it('preserves visible elements, types and text', () => {
    const visible = script.elements
      .filter((e) => !['section', 'synopsis', 'note', 'boneyard'].includes(e.type))
      .map((e) => ({ type: e.type, text: e.text, sceneNumber: e.sceneNumber, dual: e.dual }))
    const returned = back.elements.map((e) => ({
      type: e.type,
      text: e.text,
      sceneNumber: e.sceneNumber,
      dual: e.dual
    }))
    expect(returned).toEqual(visible)
  })

  it('escapes XML special characters', () => {
    expect(xml).toContain('&amp; nobody noticed &lt;yet&gt;')
  })

  it('omits sections and synopses', () => {
    expect(xml).not.toContain('Act One')
    expect(xml).not.toContain('Not exported')
  })
})
