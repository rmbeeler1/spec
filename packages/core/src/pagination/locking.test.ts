import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import type { Script, ScriptElement } from '../model/types'
import { lockPages, paginate, paginateLocked } from './paginate'
import { attachPageAnchors, snapshotPageAnchors } from '../planning/locking'

const CORPUS = join(__dirname, '../../../../test-corpus/fountain')

function bigFish(): Script {
  return parseFountain(
    readFileSync(join(CORPUS, 'spec-samples', 'Big Fish.fountain'), 'utf8'),
    { idGenerator: sequentialIdGenerator() }
  )
}

function newAction(id: string, text: string): ScriptElement {
  return { id, type: 'action', text }
}

describe('page locking and A-pages', () => {
  it('locked pagination with no edits reproduces the locked layout to the line', () => {
    const script = bigFish()
    const anchors = lockPages(script)
    const unlocked = paginate(script)
    const locked = paginateLocked(script, anchors)
    expect(locked).toHaveLength(unlocked.length)
    expect(locked.map((p) => p.label)).toEqual(unlocked.map((_, i) => String(i + 1)))
    for (let i = 0; i < locked.length; i++) {
      expect(
        locked[i]!.lines.map((l) => l.text),
        `page ${i + 1} differs`
      ).toEqual(unlocked[i]!.lines.map((l) => l.text))
    }
  })

  it('an insertion overflows into A-pages and later locked pages keep their numbers', () => {
    const script = bigFish()
    const anchors = lockPages(script)
    const unlocked = paginate(script)

    // Insert a full page of new material early in the script
    const insertAt = script.elements.findIndex(
      (e, i) => i > 5 && e.type === 'action'
    )
    const filler = Array.from({ length: 30 }, (_, i) =>
      newAction(`new-${i}`, `Inserted revision material, line ${i}, long enough to hold a row.`)
    )
    const edited: Script = {
      titlePage: script.titlePage,
      elements: [
        ...script.elements.slice(0, insertAt),
        ...filler,
        ...script.elements.slice(insertAt)
      ]
    }

    const locked = paginateLocked(edited, anchors)
    const labels = locked.map((p) => p.label!)

    // A-pages appeared right where the material went in
    const aPages = labels.filter((l) => /\d+[A-Z]+$/.test(l))
    expect(aPages.length).toBeGreaterThan(0)
    expect(aPages[0]).toMatch(/^[12][A-Z]?A$/) // early in the script

    // Every original page label survives, in order
    const plain = labels.filter((l) => /^\d+$/.test(l))
    expect(plain).toEqual(unlocked.map((_, i) => String(i + 1)))

    // The last locked page still carries its original number
    expect(labels[labels.length - 1]).toBe(String(unlocked.length))

    // No page overflows the line limit
    for (const p of locked) expect(p.lines.length).toBeLessThanOrEqual(55)
  })

  it('a deletion leaves a short page instead of renumbering', () => {
    const script = bigFish()
    const anchors = lockPages(script)
    const unlocked = paginate(script)

    // Delete most of page 2's content (keep each page's anchor element)
    const anchorIds = new Set(anchors.map((a) => a.elementId))
    const page2 = unlocked[1]!
    const page2Ids = new Set(page2.lines.map((l) => l.elementId).filter(Boolean) as string[])
    const edited: Script = {
      titlePage: script.titlePage,
      elements: script.elements.filter(
        (e, i) => i === 0 || !page2Ids.has(e.id) || anchorIds.has(e.id)
      )
    }

    const locked = paginateLocked(edited, anchors)
    const labels = locked.map((p) => p.label!)
    expect(labels).toContain('2')
    expect(labels).toContain('3')
    expect(labels.indexOf('3')).toBe(labels.indexOf('2') + 1)
    // Page 2 runs short now
    const p2 = locked[labels.indexOf('2')]!
    expect(p2.lines.length).toBeLessThan(page2.lines.length)
  })

  it('anchors round-trip through text snapshots like revision marks', () => {
    const script = bigFish()
    const anchors = lockPages(script)
    const stored = snapshotPageAnchors(script, anchors)
    // Fresh parse = fresh IDs, same text
    const reparsed = bigFish()
    const reattached = attachPageAnchors(reparsed, stored)
    expect(reattached).toHaveLength(anchors.length)
    const locked = paginateLocked(reparsed, reattached)
    expect(locked.map((p) => p.label)).toEqual(paginate(script).map((_, i) => String(i + 1)))
  })
})
