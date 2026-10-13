import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import {
  parseStashFile,
  serializeStashFile,
  stashChunkFountain,
  stashChunkSummary,
  type StashChunk
} from './stash'

function elementsOf(fountain: string) {
  return parseFountain(fountain, { idGenerator: sequentialIdGenerator() }).elements
}

const CHUNKS: StashChunk[] = [
  {
    id: 'cut1',
    cutAt: '2026-10-12T10:00:00.000Z',
    elements: elementsOf('INT. OLD OPENING - DAY\n\nThe version nobody liked.\n')
  },
  {
    id: 'cut2',
    cutAt: '2026-10-12T11:30:00.000Z',
    elements: elementsOf("MAYA\n(quietly)\nI never said that.\n")
  }
]

describe('stash file round-trip', () => {
  it('serializes and parses back to the same chunks', () => {
    const text = serializeStashFile(CHUNKS)
    const back = parseStashFile(text, { idGenerator: sequentialIdGenerator('p') })
    expect(back).toHaveLength(2)
    expect(back[0]!.id).toBe('cut1')
    expect(back[0]!.cutAt).toBe('2026-10-12T10:00:00.000Z')
    expect(back[1]!.id).toBe('cut2')

    const strip = (els: StashChunk['elements']) => els.map((e) => ({ type: e.type, text: e.text }))
    expect(strip(back[0]!.elements)).toEqual(strip(CHUNKS[0]!.elements))
    expect(strip(back[1]!.elements)).toEqual(strip(CHUNKS[1]!.elements))
  })

  it('restore text is exactly the chunk as Fountain', () => {
    const fountain = stashChunkFountain(CHUNKS[1]!)
    const back = elementsOf(fountain)
    expect(back.map((e) => e.type)).toEqual(['character', 'parenthetical', 'dialogue'])
  })

  it('keeps hand-added text before the first marker instead of dropping it', () => {
    const text = 'Some loose cut line someone pasted here.\n\n' + serializeStashFile(CHUNKS)
    const back = parseStashFile(text)
    expect(back).toHaveLength(3)
    expect(back[0]!.id).toBe('recovered')
    expect(back[0]!.elements[0]!.text).toContain('loose cut line')
  })

  it('an empty stash serializes to an empty file', () => {
    expect(serializeStashFile([])).toBe('')
    expect(parseStashFile('')).toEqual([])
  })

  it('summarizes a chunk by its first non-empty line', () => {
    expect(stashChunkSummary(CHUNKS[0]!)).toBe('INT. OLD OPENING - DAY')
  })
})
