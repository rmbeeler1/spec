import { describe, expect, it } from 'vitest'
import { emptyPlanning, parseFountain, sequentialIdGenerator, type PlanningData } from '@spec/core'
import { buildSceneCards, formatEighths, formatMinutes, pacingLanes } from './cards'
import {
  patchSceneMeta,
  refreshHeadings,
  removeBeat,
  removeStashEntry,
  addStashEntry,
  toggleBeatLink,
  upsertBeat
} from './planningState'
import { UndoPairing } from './undoPairing'
import { detectStructure } from '../editor/keymapLogic'

const SCRIPT = `# Act One

INT. HOUSE - DAY

= Maya packs up her life.

She tapes the last box shut.

MAYA
Goodbye, house.

# Act Two

EXT. ROAD - NIGHT

Rain on the windshield.
Wipers losing the fight.
`

function parsed() {
  return parseFountain(SCRIPT, { idGenerator: sequentialIdGenerator() })
}

describe('buildSceneCards', () => {
  it('builds one card per scene with synopsis, fallback, facts and stats', () => {
    const script = parsed()
    const cards = buildSceneCards(script, emptyPlanning())
    expect(cards).toHaveLength(2)

    expect(cards[0]).toMatchObject({
      heading: 'INT. HOUSE - DAY',
      body: 'Maya packs up her life.',
      bodyIsFallback: false,
      intExt: 'INT',
      timeOfDay: 'DAY',
      tension: null
    })
    // No synopsis in scene 2: first action line, flagged as fallback
    expect(cards[1]).toMatchObject({
      body: 'Rain on the windshield.',
      bodyIsFallback: true,
      intExt: 'EXT',
      timeOfDay: 'NIGHT'
    })
    expect(cards[0]!.pages).toBeGreaterThan(0)
    expect(cards[0]!.eighths).toBeGreaterThanOrEqual(1)
  })

  it('joins sidecar metadata by scene id', () => {
    const script = parsed()
    const sceneId = script.elements.find((e) => e.type === 'scene_heading')!.id
    let planning = emptyPlanning()
    planning = patchSceneMeta(planning, sceneId, 'INT. HOUSE - DAY', {
      color: 'red',
      tension: 4,
      tags: ['opening']
    })
    const cards = buildSceneCards(script, planning)
    expect(cards[0]).toMatchObject({ color: 'red', tension: 4, tags: ['opening'] })
    expect(cards[1]!.tension).toBeNull()
  })

  it('splits pacing lanes on depth-1 sections', () => {
    const script = parsed()
    const lanes = pacingLanes(script, buildSceneCards(script, emptyPlanning()))
    expect(lanes.map((l) => l.title)).toEqual(['Act One', 'Act Two'])
    expect(lanes.map((l) => l.cardIndexes)).toEqual([[0], [1]])
  })

  it('formats eighths and minutes for cards', () => {
    expect(formatEighths(3)).toBe('3/8')
    expect(formatEighths(8)).toBe('1')
    expect(formatEighths(11)).toBe('1 3/8')
    expect(formatMinutes(0.2)).toBe('~1 min')
    expect(formatMinutes(12.4)).toBe('~12 min')
  })
})

describe('planning state helpers', () => {
  const base: PlanningData = emptyPlanning()

  it('patchSceneMeta creates, merges and drops empty entries', () => {
    let d = patchSceneMeta(base, 's1', 'INT. A - DAY', { color: 'red' })
    expect(d.scenes).toHaveLength(1)
    d = patchSceneMeta(d, 's1', 'INT. A - DAY', { tension: 3 })
    expect(d.scenes[0]).toMatchObject({ color: 'red', tension: 3 })
    d = patchSceneMeta(d, 's1', 'INT. A - DAY', { color: undefined, tension: undefined })
    expect(d.scenes).toHaveLength(0)
  })

  it('refreshHeadings updates snapshots for live scenes only', () => {
    const d = patchSceneMeta(base, 's1', 'INT. OLD - DAY', { color: 'red' })
    const next = refreshHeadings(d, [
      { id: 's1', heading: 'INT. NEW - DAY' },
      { id: null, heading: 'IGNORED' }
    ])
    expect(next.scenes[0]!.heading).toBe('INT. NEW - DAY')
  })

  it('beats upsert, link toggling and removal clean up links', () => {
    let d = upsertBeat(base, { id: 'b1', title: 'A', body: '', x: 0, y: 0 })
    d = upsertBeat(d, { id: 'b2', title: 'B', body: '', x: 10, y: 10 })
    d = toggleBeatLink(d, { from: 'b1', to: 'b2' })
    expect(d.beatLinks).toHaveLength(1)
    // Toggling the reverse direction removes it
    d = toggleBeatLink(d, { from: 'b2', to: 'b1' })
    expect(d.beatLinks).toHaveLength(0)
    d = toggleBeatLink(d, { from: 'b1', to: 'b2' })
    d = removeBeat(d, 'b1')
    expect(d.beats.map((b) => b.id)).toEqual(['b2'])
    expect(d.beatLinks).toHaveLength(0)
  })

  it('stash entries add newest-first and remove by id', () => {
    let d = addStashEntry(base, { id: 'a', cutAt: '1', summary: 'first' })
    d = addStashEntry(d, { id: 'b', cutAt: '2', summary: 'second' })
    expect(d.stash.map((s) => s.id)).toEqual(['b', 'a'])
    d = removeStashEntry(d, 'a')
    expect(d.stash.map((s) => s.id)).toEqual(['b'])
  })
})

describe('UndoPairing', () => {
  it('pairs undo and redo with recorded depths', () => {
    const p = new UndoPairing()
    p.record('stash', 'e1', 5)
    // user typed since: depth is now 7, no pairing
    expect(p.matchUndo(7)).toBeNull()
    // undone down to our step
    expect(p.matchUndo(5)).toMatchObject({ kind: 'stash', entryId: 'e1' })
    // undoing further finds nothing
    expect(p.matchUndo(4)).toBeNull()
    // redo back onto our step: undo depth is 4, redo would make it 5
    expect(p.matchRedo(4)).toMatchObject({ kind: 'stash', entryId: 'e1' })
    // and it can be undone again
    expect(p.matchUndo(5)).not.toBeNull()
  })

  it('new work clears the redo pairing, like the editor history', () => {
    const p = new UndoPairing()
    p.record('stash', 'e1', 3)
    expect(p.matchUndo(3)).not.toBeNull()
    p.record('restore', 'e2', 4)
    expect(p.matchRedo(3)).toBeNull()
  })
})

describe('detectStructure (typed # and = lines)', () => {
  it('turns typed markers into sections and synopses, stripping the marker', () => {
    expect(detectStructure('# Act One', 'action')).toEqual({
      type: 'section',
      depth: 1,
      text: 'Act One'
    })
    expect(detectStructure('### Beat', 'action')).toEqual({
      type: 'section',
      depth: 3,
      text: 'Beat'
    })
    expect(detectStructure('= She leaves.', 'action')).toEqual({
      type: 'synopsis',
      text: 'She leaves.'
    })
  })

  it('leaves everything else alone', () => {
    expect(detectStructure('# Act One', 'dialogue')).toBeNull()
    expect(detectStructure('#NoSpace', 'action')).toBeNull()
    expect(detectStructure('=== page break not synopsis', 'action')).toBeNull()
    expect(detectStructure('Plain action', 'action')).toBeNull()
  })
})
