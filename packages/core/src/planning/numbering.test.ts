import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { serializeFountain } from '../fountain/serialize'
import { paginate } from '../pagination/paginate'
import { nextSceneNumber, parseSceneNumber, sequentialSceneNumbers } from './numbering'

describe('scene numbering', () => {
  it('parses plain and lettered numbers', () => {
    expect(parseSceneNumber('12')).toEqual({ base: 12, letters: '' })
    expect(parseSceneNumber('12a')).toEqual({ base: 12, letters: 'A' })
    expect(parseSceneNumber('7AB')).toEqual({ base: 7, letters: 'AB' })
    expect(parseSceneNumber('x')).toBeNull()
  })

  it('inserts between locked neighbors with A-numbers', () => {
    expect(nextSceneNumber('12', '13')).toBe('12A')
    expect(nextSceneNumber('12A', '13')).toBe('12B')
    expect(nextSceneNumber('12Z', '13')).toBe('12AA')
    expect(nextSceneNumber('12', null)).toBe('13')
    expect(nextSceneNumber(null, '1')).toBe('0A')
    expect(nextSceneNumber(null, null)).toBe('1')
  })

  it('numbers sequentially for a full pass', () => {
    expect(sequentialSceneNumbers(3)).toEqual(['1', '2', '3'])
  })

  it('numbers round-trip through Fountain and reach the page margins', () => {
    const script = parseFountain('INT. A - DAY #1#\n\nAction.\n\nEXT. B - NIGHT #1A#\n\nMore.\n', {
      idGenerator: sequentialIdGenerator()
    })
    expect(script.elements[0]!.sceneNumber).toBe('1')
    expect(script.elements[2]!.sceneNumber).toBe('1A')

    const back = parseFountain(serializeFountain(script), { idGenerator: sequentialIdGenerator() })
    expect(back.elements.filter((e) => e.type === 'scene_heading').map((e) => e.sceneNumber)).toEqual(
      ['1', '1A']
    )

    const lines = paginate(script).flatMap((p) => p.lines)
    expect(lines.filter((l) => l.sceneNumber).map((l) => l.sceneNumber)).toEqual(['1', '1A'])
  })
})
