import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { paginate, wrapLine, type RenderPage } from './paginate'

const CORPUS = join(__dirname, '../../../../test-corpus/fountain')

function load(rel: string): ReturnType<typeof parseFountain> {
  const source = readFileSync(join(CORPUS, rel), 'utf8')
  return parseFountain(source, { idGenerator: sequentialIdGenerator() })
}

function lastContentLine(page: RenderPage) {
  for (let i = page.lines.length - 1; i >= 0; i--) {
    if (page.lines[i]!.type !== 'blank') return page.lines[i]!
  }
  return null
}

function checkInvariants(pages: RenderPage[], linesPerPage = 55): void {
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!
    expect(page.lines.length).toBeLessThanOrEqual(linesPerPage)

    const last = lastContentLine(page)
    if (p < pages.length - 1 && last) {
      // Never leave a scene heading at the bottom of a page
      expect(last.type).not.toBe('scene_heading')
      // Never orphan a character cue at the bottom of a page
      expect(last.type).not.toBe('character')
      // Never end a page on a parenthetical mid-block
      expect(last.type).not.toBe('parenthetical')
    }

    // A (MORE) must be the last content line, and the next page must open
    // with a (CONT'D) cue
    for (let i = 0; i < page.lines.length; i++) {
      if (page.lines[i]!.type === 'more') {
        expect(lastContentLine(page)).toBe(page.lines[i])
        const nextPage = pages[p + 1]
        expect(nextPage).toBeDefined()
        const firstNext = nextPage!.lines.find((l) => l.type !== 'blank')
        expect(firstNext?.type).toBe('character')
        expect(firstNext?.text.endsWith("(CONT'D)")).toBe(true)
      }
    }

    // Pages never start with blank lines
    if (page.lines.length > 0) expect(page.lines[0]!.type).not.toBe('blank')
  }
}

describe('wrapLine', () => {
  it('keeps short lines whole', () => {
    expect(wrapLine('hello world', 60)).toEqual([[0, 11]])
  })
  it('wraps at word boundaries', () => {
    const line = 'aaa bbb ccc'
    expect(wrapLine(line, 7)).toEqual([
      [0, 7],
      [8, 11]
    ])
  })
  it('hard-breaks a word longer than the width', () => {
    expect(wrapLine('abcdefghij', 4)).toEqual([
      [0, 4],
      [4, 8],
      [8, 10]
    ])
  })
})

describe('pagination invariants on the corpus', () => {
  const files = [
    'spec-samples/Big Fish.fountain',
    'spec-samples/Brick And Steel.fountain',
    'spec-samples/The Last Birthday Card.fountain',
    'scripts/kitchen-sink.fountain',
    'scripts/two-page-minimal.fountain',
    'scripts/dialogue-break-stress.fountain',
    'scripts/orphan-stress.fountain'
  ]
  for (const file of files) {
    it(`holds for ${file}`, () => {
      const pages = paginate(load(file))
      expect(pages.length).toBeGreaterThan(0)
      checkInvariants(pages)
    })
  }
})

describe('dialogue page breaks', () => {
  it('splits long speeches with MORE and CONTD markers', () => {
    const pages = paginate(load('scripts/dialogue-break-stress.fountain'))
    expect(pages.length).toBeGreaterThan(3)
    const moreCount = pages.flatMap((p) => p.lines).filter((l) => l.type === 'more').length
    expect(moreCount).toBeGreaterThan(0)
    const contCues = pages
      .flatMap((p) => p.lines)
      .filter((l) => l.type === 'character' && l.text.endsWith("(CONT'D)")).length
    expect(contCues).toBe(moreCount)
  })

  it('does not stack CONTD markers on multi-page speeches', () => {
    const pages = paginate(load('scripts/dialogue-break-stress.fountain'))
    for (const line of pages.flatMap((p) => p.lines)) {
      if (line.type === 'character') {
        expect(line.text).not.toMatch(/\(CONT'D\)\s*\(CONT'D\)/)
      }
    }
  })
})

describe('page count snapshots (regression anchors)', () => {
  const files = [
    'spec-samples/Big Fish.fountain',
    'spec-samples/Brick And Steel.fountain',
    'scripts/dialogue-break-stress.fountain',
    'scripts/orphan-stress.fountain',
    'scripts/two-page-minimal.fountain',
    'scripts/kitchen-sink.fountain'
  ]
  for (const file of files) {
    it(`page count for ${file}`, () => {
      expect(paginate(load(file)).length).toMatchSnapshot()
    })
  }
})

describe('Final Draft parity gate', () => {
  // The reference count comes from John August's published PDF of this same
  // production draft, which runs about 124 pages. Until we have an exact
  // Final Draft export in the corpus (listed as a follow-up in
  // test-corpus/SOURCES.md), the release gate is 124 plus or minus 4 pages.
  it('Big Fish page count stays within the parity window', () => {
    const pages = paginate(load('spec-samples/Big Fish.fountain')).length
    expect(pages).toBeGreaterThanOrEqual(120)
    expect(pages).toBeLessThanOrEqual(128)
  })
})

describe('forced page breaks', () => {
  it('kitchen-sink === forces a new page', () => {
    const pages = paginate(load('scripts/kitchen-sink.fountain'))
    expect(pages.length).toBe(2)
  })
})
