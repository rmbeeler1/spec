import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import type { ElementType, Script } from '../model/types'
import { classifyLines, type ClassifiedType } from './classifier'
import { buildScript, extractFdTitlePage, extractTitlePage } from './build'
import { importMarkdown, importPlainText } from './text'
import { importDocx } from './docx'

const CORPUS = join(__dirname, '../../../../test-corpus')

/**
 * Render a parsed script as the plain text a writer would have in Word or a
 * .txt file: no Fountain forcing syntax, standard blank-line conventions.
 * Returns the lines and the ground-truth type of each line.
 */
function scriptToPlainLines(script: Script): { lines: string[]; truth: ClassifiedType[] } {
  const lines: string[] = []
  const truth: ClassifiedType[] = []
  const push = (text: string, type: ClassifiedType): void => {
    lines.push(text)
    truth.push(type)
  }
  const blank = (): void => {
    if (lines.length > 0 && lines[lines.length - 1] !== '') push('', 'blank')
  }

  for (const el of script.elements) {
    switch (el.type) {
      case 'scene_heading':
        blank()
        push(el.text.toUpperCase(), 'scene_heading')
        blank()
        break
      case 'action':
        blank()
        for (const l of el.text.split('\n')) push(l, 'action')
        blank()
        break
      case 'character':
        blank()
        push(el.text + (el.dual ? '' : ''), 'character')
        break
      case 'parenthetical':
        push(el.text, 'parenthetical')
        break
      case 'dialogue':
        for (const l of el.text.split('\n')) if (l !== '') push(l, 'dialogue')
        break
      case 'transition':
        blank()
        push(el.text, 'transition')
        blank()
        break
      case 'centered':
        blank()
        push(el.text, 'centered')
        blank()
        break
      default:
        break // planning elements do not appear in a plain-text script
    }
  }
  return { lines, truth }
}

const SCENE_RE = /^(INT\.?\/EXT|INT|EXT|EST|I\/E)[.\s]/i

/**
 * Plain text destroys some information on purpose: a forced scene heading
 * (".SNIPER SCOPE POV"), a forced transition ("BURN TO PINK.") and centered
 * text have no textual signal left, so classifying them as action is the
 * correct read of the input, not an error. DOCX keeps the centering hint and
 * recovers those.
 */
function acceptable(truthType: ClassifiedType, predictedType: ClassifiedType, text: string): boolean {
  if (predictedType === truthType) return true
  if (predictedType !== 'action') return false
  if (truthType === 'centered') return true
  if (truthType === 'scene_heading' && !SCENE_RE.test(text)) return true
  if (truthType === 'transition' && !/TO:$/.test(text.trim())) return true
  return false
}

function accuracy(predicted: ClassifiedType[], truth: ClassifiedType[], lines: string[]): number {
  expect(predicted.length).toBe(truth.length)
  let match = 0
  let total = 0
  for (let i = 0; i < truth.length; i++) {
    if (truth[i] === 'blank') continue
    total++
    if (acceptable(truth[i]!, predicted[i]!, lines[i]!)) match++
  }
  return match / total
}

function loadScript(rel: string): Script {
  return parseFountain(readFileSync(join(CORPUS, 'fountain', rel), 'utf8'), {
    idGenerator: sequentialIdGenerator()
  })
}

describe('classifier unit cases', () => {
  const classify = (text: string[]): ClassifiedType[] =>
    classifyLines(text.map((t) => ({ text: t }))).map((l) => l.type)

  it('handles the standard block shapes', () => {
    expect(
      classify(['INT. HOUSE - DAY', '', 'She waits.', '', 'MARGO', '(low)', 'Not yet.', '', 'CUT TO:'])
    ).toEqual([
      'scene_heading',
      'blank',
      'action',
      'blank',
      'character',
      'parenthetical',
      'dialogue',
      'blank',
      'transition'
    ])
  })

  it('keeps shouted caps action as action when it reads like a sentence', () => {
    expect(classify(['', 'THE DOOR EXPLODES INWARD, GLASS EVERYWHERE.', ''])).toEqual([
      'blank',
      'action',
      'blank'
    ])
  })

  it('lowers confidence instead of guessing wildly', () => {
    const lines = classifyLines([{ text: 'MAYBE A CUE' }, { text: 'maybe dialogue' }])
    const cue = lines[0]!
    expect(cue.type).toBe('character')
    expect(cue.confidence).toBeLessThan(0.99)
  })

  it('uses layout hints when present', () => {
    const withHint = classifyLines([
      { text: '' },
      { text: 'MARGO', indent: 0.4 },
      { text: 'Hello.', indent: 0.2 }
    ])
    const without = classifyLines([{ text: '' }, { text: 'MARGO' }, { text: 'Hello.' }])
    expect(withHint[1]!.confidence).toBeGreaterThan(without[1]!.confidence)
  })
})

describe('extractTitlePage', () => {
  it('pulls a key block off the top', () => {
    const { titlePage, rest } = extractTitlePage(['Title: Test', 'Author: Me', '', 'INT. A - DAY'])
    expect(titlePage).toEqual([
      { key: 'Title', values: ['Test'] },
      { key: 'Author', values: ['Me'] }
    ])
    expect(rest[1]).toBe('INT. A - DAY')
  })

  it('accepts a key whose values arrive on indented lines', () => {
    const { titlePage, rest } = extractTitlePage([
      'Title:',
      '\tBRICK & STEEL',
      '\tFULL RETIRED',
      'Credit: Written by',
      '',
      'EXT. PATIO - DAY'
    ])
    expect(titlePage).toEqual([
      { key: 'Title', values: ['BRICK & STEEL', 'FULL RETIRED'] },
      { key: 'Credit', values: ['Written by'] }
    ])
    expect(rest[1]).toBe('EXT. PATIO - DAY')
  })

  it('does not eat a leading transition', () => {
    const { titlePage, rest } = extractTitlePage(['CUT TO:', '', 'INT. A - DAY'])
    expect(titlePage).toEqual([])
    expect(rest.length).toBe(3)
  })
})

describe('buildScript action merging', () => {
  it('joins wrapped action lines into one paragraph, breaking on blanks', () => {
    const { script } = { script: buildScript(classifyLines([
      { text: 'The door is barricaded. It is damp. There is a barred window' },
      { text: 'just above ground level in the rear of the room.' },
      { text: '' },
      { text: 'A second paragraph stays separate.' }
    ]), [], sequentialIdGenerator()) }
    const actions = script.elements.filter((e) => e.type === 'action')
    expect(actions).toHaveLength(2)
    expect(actions[0]!.text).toBe(
      'The door is barricaded. It is damp. There is a barred window just above ground level in the rear of the room.'
    )
    expect(actions[0]!.text).not.toContain('\n')
  })
})

describe('extractFdTitlePage', () => {
  const UNFILLED = [
    '(Name of Project)',
    '',
    'by',
    '(Name of First Writer)',
    '',
    '(Based on, If Any)',
    '',
    'Revisions by',
    '(Names of Subsequent Writers,',
    'in Order of Work Performed)',
    '',
    'Current Revisions by',
    '(Current Writer, date)',
    '',
    'Name (of company, if applicable)',
    'Address',
    'Phone Number'
  ]

  it('recognizes an unfilled Final Draft template and drops every placeholder', () => {
    expect(extractFdTitlePage(UNFILLED)).toEqual([])
  })

  it('routes a filled template to title page entries', () => {
    const entries = extractFdTitlePage([
      'NIGHT OF THE LIVING TEST',
      '',
      'written by',
      'Ryan Beeler',
      '',
      'Based on a true story',
      '',
      'ryan@example.com',
      '555-0100'
    ])
    expect(entries).toEqual([
      { key: 'Title', values: ['NIGHT OF THE LIVING TEST'] },
      { key: 'Credit', values: ['written by'] },
      { key: 'Author', values: ['Ryan Beeler'] },
      { key: 'Source', values: ['Based on a true story'] },
      { key: 'Contact', values: ['ryan@example.com', '555-0100'] }
    ])
  })

  it('a dangling "by" with a placeholder author produces no credit entry', () => {
    expect(extractFdTitlePage(['REAL TITLE', 'by', '(Name of First Writer)'])).toEqual([
      { key: 'Title', values: ['REAL TITLE'] }
    ])
  })

  it('refuses pages that are script content, not a title page', () => {
    expect(extractFdTitlePage(['INT. BASEMENT - DAY', '', 'The door is barricaded.'])).toBeNull()
    expect(extractFdTitlePage(['Just some action.', 'More action.'])).toBeNull()
    const long = Array.from({ length: 20 }, (_, i) => `Line ${i}`)
    expect(extractFdTitlePage(['TITLE', 'by', 'Someone', ...long])).toBeNull()
  })
})

describe('accuracy gates on the corpus', () => {
  const files = [
    'spec-samples/Big Fish.fountain',
    'spec-samples/Brick And Steel.fountain',
    'spec-samples/The Last Birthday Card.fountain'
  ]

  it('clean plain text: at least 95% of lines correctly typed', () => {
    for (const file of files) {
      const { lines, truth } = scriptToPlainLines(loadScript(file))
      const predicted = classifyLines(lines.map((t) => ({ text: t }))).map((l) => l.type)
      const score = accuracy(predicted, truth, lines)
      expect(score, `${file}: ${(score * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.95)
    }
  })

  it('messy plain text: at least 85% of lines correctly typed', () => {
    for (const file of files) {
      const { lines, truth } = scriptToPlainLines(loadScript(file))
      // Simulate sloppy Word habits: lowercased transitions, doubled blank
      // lines, stray trailing whitespace. Blank doubling keeps the non-blank
      // sequence (and therefore the truth labels) aligned.
      const messyLines: string[] = []
      const messyTruth: ClassifiedType[] = []
      for (let i = 0; i < lines.length; i++) {
        let text = lines[i]!
        if (truth[i] === 'transition') text = text.toLowerCase()
        messyLines.push(text + (i % 3 === 0 ? '  ' : ''))
        messyTruth.push(truth[i]!)
        if (text === '' && i % 2 === 0) {
          messyLines.push('')
          messyTruth.push('blank')
        }
      }
      const predicted = classifyLines(messyLines.map((t) => ({ text: t }))).map((l) => l.type)
      const score = accuracy(predicted, messyTruth, messyLines)
      expect(score, `${file}: ${(score * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.85)
    }
  })
})

describe('importPlainText end to end', () => {
  it('rebuilds a script close to the original', () => {
    const original = loadScript('spec-samples/Brick And Steel.fountain')
    const { lines } = scriptToPlainLines(original)
    const { script } = importPlainText(lines.join('\n'), {
      idGenerator: sequentialIdGenerator()
    })
    const count = (s: Script, type: ElementType): number =>
      s.elements.filter((e) => e.type === type).length
    // Two of the original headings are forced (no INT/EXT), invisible in
    // plain text by design, so allow that gap.
    expect(Math.abs(count(script, 'scene_heading') - count(original, 'scene_heading'))).toBeLessThanOrEqual(2)
    expect(Math.abs(count(script, 'character') - count(original, 'character'))).toBeLessThanOrEqual(3)
  })
})

describe('importMarkdown', () => {
  it('maps markdown headings to sections with depth', () => {
    const { script } = importMarkdown('# Act One\n\n## Sequence A\n\nINT. HOUSE - DAY\n\nAction.\n', {
      idGenerator: sequentialIdGenerator()
    })
    const sections = script.elements.filter((e) => e.type === 'section')
    expect(sections.map((s) => ({ text: s.text, depth: s.depth }))).toEqual([
      { text: 'Act One', depth: 1 },
      { text: 'Sequence A', depth: 2 }
    ])
    expect(script.elements.some((e) => e.type === 'scene_heading')).toBe(true)
  })
})

describe('importDocx on the corpus', () => {
  it('imports Big Fish.docx with sane structure and the title page', () => {
    const data = readFileSync(join(CORPUS, 'docx/Big Fish.docx'))
    const { script } = importDocx(data, { idGenerator: sequentialIdGenerator() })
    const original = loadScript('spec-samples/Big Fish.fountain')

    expect(script.titlePage.find((e) => e.key === 'Title')?.values[0]).toBe('Big Fish')

    const headings = script.elements.filter((e) => e.type === 'scene_heading').length
    const originalHeadings = original.elements.filter((e) => e.type === 'scene_heading').length
    expect(Math.abs(headings - originalHeadings)).toBeLessThanOrEqual(originalHeadings * 0.05 + 2)

    const cues = script.elements.filter((e) => e.type === 'character').length
    const originalCues = original.elements.filter((e) => e.type === 'character').length
    expect(cues).toBeGreaterThanOrEqual(originalCues * 0.85)
  })

  it('rejects non-docx data with a clear error', () => {
    expect(() => importDocx(new Uint8Array([1, 2, 3]))).toThrow(/Not a \.docx/)
  })
})
