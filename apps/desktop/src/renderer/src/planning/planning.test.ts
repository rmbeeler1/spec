import { describe, expect, it } from 'vitest'
import {
  emptyPlanning,
  parseFountain,
  parsePlanning,
  sequentialIdGenerator,
  serializePlanning,
  type PlanningData
} from '@spec/core'
import { buildSceneCards, formatEighths, formatMinutes, pacingLanes } from './cards'
import {
  localDay,
  orphanSceneEntries,
  patchSceneMeta,
  recordWriting,
  setWritingGoal,
  reattachSceneMeta,
  refreshHeadings,
  removeBeat,
  removeSceneMeta,
  removeStashEntry,
  addStashEntry,
  toggleBeatLink,
  upsertBeat
} from './planningState'
import { UndoPairing } from './undoPairing'
import { detectStructure } from '../editor/keymapLogic'
import { dualToggleDecision } from '../editor/dual'

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
    const lanes = pacingLanes(script)
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

  it('finds orphaned scene entries and re-attaches them with a merge', () => {
    let d = patchSceneMeta(base, 'dead', 'INT. GONE - DAY', { color: 'red', tension: 4 })
    d = patchSceneMeta(d, 'live', 'INT. HERE - DAY', { tags: ['keep'] })

    const orphans = orphanSceneEntries(d, new Set(['live']))
    expect(orphans.map((o) => o.id)).toEqual(['dead'])

    // Re-attach the orphan onto the live scene: fields merge, orphan goes
    d = reattachSceneMeta(d, 'dead', { id: 'live', heading: 'INT. HERE - DAY' })
    expect(d.scenes).toHaveLength(1)
    expect(d.scenes[0]).toMatchObject({
      id: 'live',
      color: 'red',
      tension: 4,
      tags: ['keep']
    })
    expect(orphanSceneEntries(d, new Set(['live']))).toEqual([])
  })

  it('removeSceneMeta discards a dead entry', () => {
    let d = patchSceneMeta(base, 'dead', 'INT. GONE - DAY', { color: 'red' })
    d = removeSceneMeta(d, 'dead')
    expect(d.scenes).toEqual([])
  })

  it('stash entries add newest-first and remove by id', () => {
    let d = addStashEntry(base, { id: 'a', cutAt: '1', summary: 'first' })
    d = addStashEntry(d, { id: 'b', cutAt: '2', summary: 'second' })
    expect(d.stash.map((s) => s.id)).toEqual(['b', 'a'])
    d = removeStashEntry(d, 'a')
    expect(d.stash.map((s) => s.id)).toEqual(['b'])
  })
})

describe('writing stats', () => {
  it('accumulates per day, ignores non-positive deltas, sorts history', () => {
    let d = recordWriting(emptyPlanning(), '2026-10-12', 120, 1)
    d = recordWriting(d, '2026-10-12', 80, 0)
    d = recordWriting(d, '2026-10-11', 50, 0)
    d = recordWriting(d, '2026-10-12', -30, -1) // deletions never subtract
    expect(d.writing!.history).toEqual([
      { date: '2026-10-11', words: 50, pages: 0 },
      { date: '2026-10-12', words: 200, pages: 1 }
    ])
  })

  it('round-trips through the sidecar with a goal', () => {
    let d = recordWriting(emptyPlanning(), '2026-10-12', 10, 0)
    d = setWritingGoal(d, { kind: 'words', perDay: 500 })
    const back = parsePlanning(serializePlanning(d))
    expect(back.hadErrors).toBe(false)
    expect(back.data.writing).toEqual(d.writing)
    // clearing the goal with no history removes the block entirely
    const cleared = setWritingGoal(emptyPlanning(), undefined)
    expect(cleared.writing).toBeUndefined()
  })

  it('localDay formats a local calendar date', () => {
    expect(localDay(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12')
    expect(localDay(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02')
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

describe('dualToggleDecision', () => {
  const el = (type: string, dual = false) => ({ type, dual })
  // [heading, action, MAYA, dialog, SCOTT, (paren), dialog, action]
  const DOC = [
    el('scene_heading'),
    el('action'),
    el('character'),
    el('dialogue'),
    el('character'),
    el('parenthetical'),
    el('dialogue'),
    el('action')
  ]

  it('caret in the second speech marks its own cue', () => {
    expect(dualToggleDecision(DOC, 6)).toEqual({ targetIndex: 4, makeDual: true })
    expect(dualToggleDecision(DOC, 5)).toEqual({ targetIndex: 4, makeDual: true })
    expect(dualToggleDecision(DOC, 4)).toEqual({ targetIndex: 4, makeDual: true })
  })

  it('caret in the first speech marks the following cue instead', () => {
    expect(dualToggleDecision(DOC, 3)).toEqual({ targetIndex: 4, makeDual: true })
    expect(dualToggleDecision(DOC, 2)).toEqual({ targetIndex: 4, makeDual: true })
  })

  it('unmarks from either speech when the pair exists', () => {
    const paired = DOC.map((e, i) => (i === 4 ? el('character', true) : e))
    expect(dualToggleDecision(paired, 6)).toEqual({ targetIndex: 4, makeDual: false })
    expect(dualToggleDecision(paired, 3)).toEqual({ targetIndex: 4, makeDual: false })
  })

  it('refuses with a reason when there is no adjacent speech', () => {
    const lone = [el('scene_heading'), el('action'), el('character'), el('dialogue'), el('action')]
    const result = dualToggleDecision(lone, 3)
    expect(result).toHaveProperty('reason')
    expect((result as { reason: string }).reason).toContain('back to back')
  })

  it('refuses with guidance when the caret is not in a speech', () => {
    expect(dualToggleDecision(DOC, 1)).toHaveProperty('reason')
    expect(dualToggleDecision(DOC, 0)).toHaveProperty('reason')
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
    // Enter after dialogue flows into a character element; a typed # line
    // there is still a section, never a cue
    expect(detectStructure('# Act Three', 'character')).toEqual({
      type: 'section',
      depth: 1,
      text: 'Act Three'
    })
  })

  it('leaves everything else alone', () => {
    expect(detectStructure('# Act One', 'dialogue')).toBeNull()
    expect(detectStructure('#NoSpace', 'action')).toBeNull()
    expect(detectStructure('=== page break not synopsis', 'action')).toBeNull()
    expect(detectStructure('Plain action', 'action')).toBeNull()
  })
})
