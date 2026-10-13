import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ClassifiedLine } from '@spec/core'
import {
  applyTypeToSelection,
  doubtfulCount,
  rangeBetween,
  selectDoubtful,
  visibleIndices
} from './reviewLogic'
import { routeImport } from './route'

const CORPUS = join(__dirname, '../../../../../../test-corpus')

const lines: ClassifiedLine[] = [
  { text: 'INT. A - DAY', type: 'scene_heading', confidence: 0.98 },
  { text: '', type: 'blank', confidence: 1 },
  { text: 'MAYBE A CUE', type: 'character', confidence: 0.55 },
  { text: 'Something.', type: 'dialogue', confidence: 0.85 },
  { text: 'SHOUTY LINE.', type: 'action', confidence: 0.6 }
]

describe('review pane logic', () => {
  it('lists non-blank lines, optionally doubtful first', () => {
    expect(visibleIndices(lines, false)).toEqual([0, 2, 3, 4])
    expect(visibleIndices(lines, true)).toEqual([2, 4, 3, 0])
  })

  it('counts doubtful lines under the threshold', () => {
    expect(doubtfulCount(lines)).toBe(2)
  })

  it('bulk-applies a type with full confidence, skipping blanks', () => {
    const updated = applyTypeToSelection(lines, new Set([1, 2, 4]), 'action')
    expect(updated[1]!.type).toBe('blank')
    expect(updated[2]).toEqual({ text: 'MAYBE A CUE', type: 'action', confidence: 1 })
    expect(updated[4]!.confidence).toBe(1)
    expect(updated[0]).toEqual(lines[0])
  })

  it('selects doubtful lines and shift-click ranges', () => {
    expect([...selectDoubtful(lines)]).toEqual([2, 4])
    expect([...rangeBetween([0, 2, 3, 4], 2, 4)]).toEqual([2, 3, 4])
  })
})

describe('routeImport', () => {
  const read = (rel: string): Uint8Array => new Uint8Array(readFileSync(join(CORPUS, rel)))

  it('loads fountain and fdx directly', async () => {
    const fountain = await routeImport('a.fountain', read('fountain/scripts/two-page-minimal.fountain'))
    expect(fountain.kind).toBe('direct')

    const fdx = await routeImport('Big Fish.fdx', read('fdx/Big Fish.fdx'))
    expect(fdx.kind).toBe('direct')
    if (fdx.kind === 'direct') expect(fdx.content).toContain('EXT.')
  })

  it('routes docx through the review pane with classified lines', async () => {
    const routed = await routeImport('Big Fish.docx', read('docx/Big Fish.docx'))
    expect(routed.kind).toBe('review')
    if (routed.kind === 'review') {
      expect(routed.pending.lines.length).toBeGreaterThan(1000)
      expect(routed.pending.titlePage.find((e) => e.key === 'Title')?.values[0]).toBe('Big Fish')
    }
  })

  it('routes pdf through the review pane', async () => {
    const routed = await routeImport('Brick And Steel.pdf', read('pdf/Brick And Steel.pdf'))
    expect(routed.kind).toBe('review')
    if (routed.kind === 'review') {
      expect(routed.pending.lines.some((l) => l.type === 'scene_heading')).toBe(true)
    }
  }, 60_000)

  it('rejects unknown extensions', async () => {
    await expect(routeImport('notes.rtf', new Uint8Array([1]))).rejects.toThrow(/Cannot import/)
  })
})
