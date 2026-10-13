import { describe, expect, it } from 'vitest'
import {
  attachSceneMeta,
  emptyPlanning,
  isPlanningEmpty,
  parsePlanning,
  serializePlanning,
  sidecarPathFor,
  stashPathFor,
  type PlanningData
} from './sidecar'

const SAMPLE: PlanningData = {
  version: 1,
  scenes: [
    { id: 's1', heading: 'INT. HOUSE - DAY', color: 'red', tags: ['open'], tension: 3 },
    { id: 's2', heading: 'EXT. ROAD - NIGHT', storylines: ['sl1'] }
  ],
  beats: [{ id: 'b1', title: 'Midpoint', body: 'Everything turns', x: 120, y: 40, color: 'blue' }],
  beatLinks: [{ from: 'b1', to: 'b1' }],
  stash: [{ id: 'st1', cutAt: '2026-10-12T00:00:00.000Z', summary: 'Old opening' }],
  storylines: [{ id: 'sl1', name: 'Heist', color: 'green' }]
}

describe('sidecar round-trip and validation', () => {
  it('round-trips planning data through JSON', () => {
    const { data, hadErrors } = parsePlanning(serializePlanning(SAMPLE))
    expect(hadErrors).toBe(false)
    expect(data).toEqual(SAMPLE)
  })

  it('never throws on garbage and reports errors', () => {
    expect(parsePlanning('not json').hadErrors).toBe(true)
    expect(parsePlanning('not json').data).toEqual(emptyPlanning())
    expect(parsePlanning('42').hadErrors).toBe(true)
    expect(parsePlanning('{"scenes": "nope"}').hadErrors).toBe(true)
  })

  it('skips malformed entries but keeps good ones', () => {
    const { data, hadErrors } = parsePlanning(
      JSON.stringify({
        version: 1,
        scenes: [{ id: 's1', heading: 'INT. A - DAY' }, { id: 42 }],
        beats: [{ id: 'b1', x: 'left', y: 0 }],
        beatLinks: [{ from: 'ghost', to: 'b1' }]
      })
    )
    expect(hadErrors).toBe(true)
    expect(data.scenes).toHaveLength(1)
    expect(data.beats).toHaveLength(0)
    expect(data.beatLinks).toHaveLength(0)
  })

  it('rejects tension values outside 1..5 (unset stays unset, never zero)', () => {
    const { data } = parsePlanning(
      JSON.stringify({
        version: 1,
        scenes: [
          { id: 'a', heading: 'INT. A - DAY', tension: 0 },
          { id: 'b', heading: 'INT. B - DAY', tension: 5 }
        ]
      })
    )
    expect(data.scenes[0]!.tension).toBeUndefined()
    expect(data.scenes[1]!.tension).toBe(5)
  })

  it('knows when planning is empty', () => {
    expect(isPlanningEmpty(emptyPlanning())).toBe(true)
    expect(isPlanningEmpty(SAMPLE)).toBe(false)
  })
})

describe('sidecar and stash file naming', () => {
  it('derives sibling file names from the script path', () => {
    expect(sidecarPathFor('/a/b/MyScript.fountain')).toBe('/a/b/MyScript.spec.json')
    expect(stashPathFor('/a/b/MyScript.fountain')).toBe('/a/b/MyScript.stash.fountain')
    expect(sidecarPathFor('C:\\scripts\\Pilot.FOUNTAIN')).toBe('C:\\scripts\\Pilot.spec.json')
    expect(sidecarPathFor('/a/notes.txt')).toBe('/a/notes.spec.json')
  })
})

describe('attachSceneMeta', () => {
  const entries = [
    { id: 'old1', heading: 'INT. HOUSE - DAY', color: 'red' },
    { id: 'old2', heading: 'EXT. ROAD - NIGHT', tension: 4 },
    { id: 'old3', heading: 'INT. GONE - DAY', tags: ['lost'] }
  ]

  it('re-keys entries to fresh scene IDs by heading', () => {
    const { attached, orphans } = attachSceneMeta(
      [
        { id: 'new1', heading: 'INT. HOUSE - DAY' },
        { id: 'new2', heading: 'EXT. ROAD - NIGHT' }
      ],
      entries
    )
    expect(attached.map((a) => a.id)).toEqual(['new1', 'new2'])
    expect(attached[0]!.color).toBe('red')
    expect(attached[1]!.tension).toBe(4)
    expect(orphans.map((o) => o.id)).toEqual(['old3'])
  })

  it('matches case- and whitespace-insensitively', () => {
    const { attached } = attachSceneMeta(
      [{ id: 'n', heading: 'int.  house -  day' }],
      [{ id: 'o', heading: 'INT. HOUSE - DAY', color: 'blue' }]
    )
    expect(attached).toHaveLength(1)
    expect(attached[0]!.id).toBe('n')
  })

  it('pairs duplicate headings by order', () => {
    const { attached } = attachSceneMeta(
      [
        { id: 'n1', heading: 'INT. CAR - DAY' },
        { id: 'n2', heading: 'INT. CAR - DAY' }
      ],
      [
        { id: 'o1', heading: 'INT. CAR - DAY', color: 'first' },
        { id: 'o2', heading: 'INT. CAR - DAY', color: 'second' }
      ]
    )
    expect(attached[0]).toMatchObject({ id: 'n1', color: 'first' })
    expect(attached[1]).toMatchObject({ id: 'n2', color: 'second' })
  })
})
