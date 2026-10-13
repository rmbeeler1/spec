import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { parsePlanning, serializePlanning } from './sidecar'
import { emptyPlanning } from './sidecar'
import {
  attachRevisionMarks,
  nextRevisionColor,
  snapshotRevisionMarks,
  type RevisionMark
} from './revisions'

const SCRIPT = `INT. KITCHEN - DAY

Maya cooks eggs.

MAYA
Breakfast!

EXT. YARD - DAY

Maya cooks eggs.
`

function parsed() {
  return parseFountain(SCRIPT, { idGenerator: sequentialIdGenerator() })
}

describe('revision marks', () => {
  it('re-attaches by scene, type and text, first occurrence wins', () => {
    const script = parsed()
    const marks: RevisionMark[] = [
      { setId: 'blue', scene: 'INT. KITCHEN - DAY', type: 'action', text: 'Maya cooks eggs.' },
      { setId: 'blue', scene: 'EXT. YARD - DAY', type: 'action', text: 'Maya cooks eggs.' },
      { setId: 'blue', scene: 'INT. KITCHEN - DAY', type: 'dialogue', text: 'Gone line.' }
    ]
    const { live, unmatched } = attachRevisionMarks(script, marks)
    expect(live.size).toBe(2)
    // The identical action lines land in their own scenes
    const kitchenAction = script.elements.find(
      (e) => e.type === 'action' && script.elements.indexOf(e) === 1
    )!
    expect(live.get(kitchenAction.id)).toBe('blue')
    expect(unmatched).toHaveLength(1)
    expect(unmatched[0]!.text).toBe('Gone line.')
  })

  it('snapshots live marks with current text and keeps unmatched ones', () => {
    const script = parsed()
    const dialogue = script.elements.find((e) => e.type === 'dialogue')!
    const live = new Map([[dialogue.id, 'pink']])
    const unmatched: RevisionMark[] = [
      { setId: 'blue', scene: 'X', type: 'action', text: 'ghost' }
    ]
    const out = snapshotRevisionMarks(script, live, unmatched)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      setId: 'pink',
      scene: 'INT. KITCHEN - DAY',
      type: 'dialogue',
      text: 'Breakfast!'
    })
    expect(out[1]!.text).toBe('ghost')
  })

  it('marks with trailing whitespace survive a serialize/parse round trip', () => {
    // Typed text often ends with a space; Fountain parsing trims it, so the
    // anchor must still match after a reload
    const script = parsed()
    const action = script.elements.find((e) => e.type === 'action')!
    const live = new Map([[action.id, 'blue']])
    const stored = snapshotRevisionMarks(
      { ...script, elements: script.elements.map((e) => (e.id === action.id ? { ...e, text: e.text + '  ' } : e)) },
      live,
      []
    )
    const { live: reattached, unmatched } = attachRevisionMarks(parsed(), stored)
    expect(unmatched).toEqual([])
    expect(reattached.size).toBe(1)
  })

  it('cycles the standard color order', () => {
    expect(nextRevisionColor(0)).toBe('Blue')
    expect(nextRevisionColor(1)).toBe('Pink')
    expect(nextRevisionColor(8)).toBe('Blue')
  })

  it('revisions and omitted scenes round-trip through the sidecar', () => {
    const data = {
      ...emptyPlanning(),
      revisions: {
        sets: [{ id: 's1', name: 'Blue Draft', color: 'Blue', startedAt: '2026-10-12' }],
        activeSetId: 's1',
        marks: [
          { setId: 's1', scene: 'INT. A - DAY', type: 'action' as const, text: 'Revised line.' }
        ]
      },
      omitted: [{ sceneNumber: '12', chunkId: 'c1', originalHeading: 'INT. GONE - DAY' }]
    }
    const back = parsePlanning(serializePlanning(data))
    expect(back.hadErrors).toBe(false)
    expect(back.data.revisions).toEqual(data.revisions)
    expect(back.data.omitted).toEqual(data.omitted)
  })

  it('drops marks pointing at unknown sets, keeps the rest', () => {
    const { data, hadErrors } = parsePlanning(
      JSON.stringify({
        version: 1,
        revisions: {
          sets: [{ id: 's1', name: 'Blue', color: 'Blue', startedAt: 'x' }],
          marks: [
            { setId: 'ghost', scene: '', type: 'action', text: 'a' },
            { setId: 's1', scene: '', type: 'action', text: 'b' }
          ]
        }
      })
    )
    expect(hadErrors).toBe(true)
    expect(data.revisions!.marks).toHaveLength(1)
  })
})
