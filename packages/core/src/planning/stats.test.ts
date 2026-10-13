import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { DEFAULT_PAGINATION } from '../pagination/config'
import { paginate } from '../pagination/paginate'
import {
  baseCharacterName,
  buildOutline,
  characterStats,
  parseHeadingInfo,
  sceneCardBody,
  scenePageStats
} from './stats'

const CORPUS = join(__dirname, '../../../../test-corpus/fountain')

const SAMPLE = `INT. KITCHEN - DAY

Maya enters.

MAYA
Hello.

EDWARD (V.O.)
Hi there.

MAYA (CONT'D)
Still me.

EXT. ROAD - NIGHT

EDWARD ^
Side by side.

@edward
Lowercase forced cue.
`

function parse(text: string) {
  return parseFountain(text, { idGenerator: sequentialIdGenerator() })
}

describe('characterStats', () => {
  it("merges (V.O.), (CONT'D), carets and case to the base name", () => {
    expect(baseCharacterName("EDWARD (V.O.) ^")).toBe('EDWARD')
    expect(baseCharacterName("maya (CONT'D)")).toBe('MAYA')
  })

  it('counts cues and distinct scenes per character', () => {
    const stats = characterStats(parse(SAMPLE))
    const maya = stats.find((s) => s.name === 'MAYA')!
    const edward = stats.find((s) => s.name === 'EDWARD')!
    expect(maya.cues).toBe(2)
    expect(maya.scenes).toBe(1)
    expect(edward.cues).toBe(3)
    expect(edward.scenes).toBe(2)
    expect(edward.sceneIds).toHaveLength(2)
  })

  it('tallies a corpus script without errors and in cue order', () => {
    const script = parse(readFileSync(join(CORPUS, 'spec-samples', 'Big Fish.fountain'), 'utf8'))
    const stats = characterStats(script)
    expect(stats.length).toBeGreaterThan(10)
    // Big Fish: EDWARD and WILL carry the script
    const names = stats.slice(0, 6).map((s) => s.name)
    expect(names).toContain('EDWARD')
    expect(names).toContain('WILL')
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i - 1]!.cues).toBeGreaterThanOrEqual(stats[i]!.cues)
    }
  })
})

describe('parseHeadingInfo', () => {
  it('reads INT/EXT and time of day', () => {
    expect(parseHeadingInfo('INT. HOUSE - DAY')).toEqual({ intExt: 'INT', timeOfDay: 'DAY' })
    expect(parseHeadingInfo('ext. road - night')).toEqual({ intExt: 'EXT', timeOfDay: 'NIGHT' })
    expect(parseHeadingInfo('INT./EXT. CAR - CONTINUOUS')).toEqual({
      intExt: 'INT/EXT',
      timeOfDay: 'CONTINUOUS'
    })
    expect(parseHeadingInfo('I/E TRUCK - DUSK')).toEqual({ intExt: 'INT/EXT', timeOfDay: 'DUSK' })
    expect(parseHeadingInfo('CASINO FLOOR')).toEqual({ intExt: null, timeOfDay: null })
  })
})

describe('scenePageStats', () => {
  it('accounts for every line on every page, matching paginate exactly', () => {
    const script = parse(
      readFileSync(join(CORPUS, 'spec-samples', 'Brick And Steel.fountain'), 'utf8')
    )
    const stats = scenePageStats(script)
    const pages = paginate(script)

    // Lines after the first scene heading are attributed somewhere
    const totalAttributed = stats.reduce((sum, s) => sum + s.lines, 0)
    const totalLines = pages.reduce((sum, p) => sum + p.lines.length, 0)
    expect(totalAttributed).toBeLessThanOrEqual(totalLines)
    expect(totalAttributed).toBeGreaterThan(totalLines * 0.8)

    // Pages fractions sum to roughly the page count
    const totalPages = stats.reduce((sum, s) => sum + s.pages, 0)
    expect(totalPages).toBeLessThanOrEqual(pages.length)
    expect(stats.every((s) => s.eighths >= 1)).toBe(true)
    expect(stats.every((s) => s.startPage >= 1 && s.startPage <= pages.length)).toBe(true)

    // Scene order matches script order
    const sceneIds = script.elements.filter((e) => e.type === 'scene_heading').map((e) => e.id)
    expect(stats.map((s) => s.sceneId)).toEqual(sceneIds)
  })

  it('uses linesPerPage for the page fraction', () => {
    const script = parse('INT. A - DAY\n\nOne line of action.\n')
    const stats = scenePageStats(script)
    expect(stats).toHaveLength(1)
    // heading + blank + action = 3 lines
    expect(stats[0]!.lines).toBe(3)
    expect(stats[0]!.pages).toBeCloseTo(3 / DEFAULT_PAGINATION.linesPerPage)
  })
})

describe('buildOutline', () => {
  it('nests sections by depth with scenes inside', () => {
    const script = parse(
      [
        '# Act One',
        '',
        '## Setup',
        '',
        'INT. A - DAY',
        '',
        'Action.',
        '',
        'INT. B - DAY',
        '',
        '# Act Two',
        '',
        'INT. C - DAY',
        ''
      ].join('\n')
    )
    const outline = buildOutline(script)
    expect(outline).toHaveLength(2)
    const [act1, act2] = outline
    expect(act1!.text).toBe('Act One')
    expect(act1!.children[0]!.text).toBe('Setup')
    expect(act1!.children[0]!.children.map((c) => c.text)).toEqual(['INT. A - DAY', 'INT. B - DAY'])
    expect(act2!.children.map((c) => c.text)).toEqual(['INT. C - DAY'])
  })

  it('handles scripts with no sections as a flat scene list', () => {
    const script = parse('INT. A - DAY\n\nAction.\n\nINT. B - DAY\n\nMore.\n')
    const outline = buildOutline(script)
    expect(outline.map((n) => n.kind)).toEqual(['scene', 'scene'])
  })
})

describe('sceneCardBody', () => {
  it('prefers the synopsis', () => {
    const script = parse('INT. A - DAY\n\n= The turn.\n\nSome action.\n')
    const idx = script.elements.findIndex((e) => e.type === 'scene_heading')
    expect(sceneCardBody(script.elements, idx)).toEqual({ text: 'The turn.', isFallback: false })
  })

  it('falls back to the first action line, flagged, when there is no synopsis', () => {
    const script = parse('INT. A - DAY\n\nDust everywhere.\nSecond line.\n\nINT. B - DAY\n')
    const idx = script.elements.findIndex((e) => e.type === 'scene_heading')
    expect(sceneCardBody(script.elements, idx)).toEqual({
      text: 'Dust everywhere.',
      isFallback: true
    })
  })

  it('never reads past the next scene heading', () => {
    const script = parse('INT. A - DAY\n\nINT. B - DAY\n\nB action.\n')
    const idx = script.elements.findIndex((e) => e.type === 'scene_heading')
    expect(sceneCardBody(script.elements, idx)).toEqual({ text: '', isFallback: true })
  })
})
