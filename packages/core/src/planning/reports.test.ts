import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { buildReports, headingLocation, reportToCsv, reportToText } from './reports'

const CORPUS = join(__dirname, '../../../../test-corpus/fountain')

const SAMPLE = `INT. HOUSE - DAY #1#

Maya enters, dripping.

MAYA
Two words. Three more words.

EXT. HOUSE - NIGHT #2#

MAYA
One two three.

STRANGER
Hi.
`

function parsed(text = SAMPLE) {
  return parseFountain(text, { idGenerator: sequentialIdGenerator() })
}

describe('headingLocation', () => {
  it('strips prefix and time of day', () => {
    expect(headingLocation('INT. HOUSE - DAY')).toBe('HOUSE')
    expect(headingLocation('EXT. COASTAL HIGHWAY 1 - OVERLOOK - NIGHT')).toBe(
      'COASTAL HIGHWAY 1 - OVERLOOK'
    )
    expect(headingLocation('I/E TRUCK - DUSK')).toBe('TRUCK')
  })
})

describe('buildReports', () => {
  const reports = buildReports(parsed())
  const byId = Object.fromEntries(reports.map((r) => [r.id, r]))

  it('scene list carries numbers, pages and lengths', () => {
    expect(byId['scenes']!.rows).toHaveLength(2)
    expect(byId['scenes']!.rows[0]![0]).toBe('1')
    expect(byId['scenes']!.rows[0]![1]).toBe('INT. HOUSE - DAY')
    expect(byId['scenes']!.rows[0]![2]).toBe('1')
    expect(byId['scenes']!.rows[0]![3]).toMatch(/\/8|^\d/)
  })

  it('characters report counts speeches, words, scenes and first appearance', () => {
    const maya = byId['characters']!.rows.find((r) => r[0] === 'MAYA')!
    expect(maya[1]).toBe('2') // speeches
    expect(maya[2]).toBe('8') // words of dialogue
    expect(maya[3]).toBe('2') // scenes
    expect(maya[4]).toBe('INT. HOUSE - DAY')
  })

  it('locations merge INT and EXT of the same place', () => {
    expect(byId['locations']!.rows).toEqual([['HOUSE', '2']])
  })

  it('breakdowns add up to the scene count', () => {
    const total = (id: string): number =>
      byId[id]!.rows.reduce((n, r) => n + parseInt(r[1]!, 10), 0)
    expect(total('int-ext')).toBe(2)
    expect(total('day-night')).toBe(2)
  })

  it('computes a full corpus script without error and consistently', () => {
    const script = parsed(
      readFileSync(join(CORPUS, 'spec-samples', 'Big Fish.fountain'), 'utf8')
    )
    const r = buildReports(script)
    const byId2 = Object.fromEntries(r.map((t) => [t.id, t]))
    const sceneCount = script.elements.filter((e) => e.type === 'scene_heading').length
    expect(byId2['scenes']!.rows).toHaveLength(sceneCount)
    const ieTotal = byId2['int-ext']!.rows.reduce((n, row) => n + parseInt(row[1]!, 10), 0)
    expect(ieTotal).toBe(sceneCount)
    expect(byId2['characters']!.rows.length).toBeGreaterThan(10)
    expect(byId2['locations']!.rows.length).toBeGreaterThan(5)
  })
})

describe('report export formats', () => {
  const table = {
    id: 't',
    title: 'Test',
    columns: ['A', 'B'],
    rows: [
      ['plain', 'with, comma'],
      ['with "quotes"', 'x']
    ]
  }

  it('escapes CSV properly', () => {
    const csv = reportToCsv(table)
    expect(csv).toBe('A,B\nplain,"with, comma"\n"with ""quotes""",x\n')
  })

  it('aligns text columns', () => {
    const text = reportToText(table)
    expect(text).toContain('Test')
    const lines = text.split('\n')
    const header = lines.find((l) => l.startsWith('A'))!
    expect(header.indexOf('B')).toBeGreaterThan(1)
  })
})
