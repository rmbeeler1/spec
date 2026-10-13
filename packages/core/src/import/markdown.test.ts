import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sequentialIdGenerator } from '../model/ids'
import { paginate } from '../pagination/paginate'
import { importMarkdown } from './markdown'
import { stripInlineMarkdown } from './markdown'

const CORPUS = join(__dirname, '../../../../test-corpus')

describe('stripInlineMarkdown', () => {
  it('removes emphasis markers, keeps text', () => {
    expect(stripInlineMarkdown('**INT. HOSPITAL - DAY**')).toBe('INT. HOSPITAL - DAY')
    expect(stripInlineMarkdown('*(voice flat)*')).toBe('(voice flat)')
    expect(stripInlineMarkdown('***all of it***')).toBe('all of it')
    expect(stripInlineMarkdown('__under__ and _more_')).toBe('under and more')
    expect(stripInlineMarkdown('snake_case_word stays')).toBe('snake_case_word stays')
    expect(stripInlineMarkdown('plain text')).toBe('plain text')
  })
})

describe('EL AHOGADO: a real-world messy Markdown screenplay', () => {
  const source = readFileSync(join(CORPUS, 'md/EL_AHOGADO_Screenplay.md'), 'utf8')
  const { script, lines } = importMarkdown(source, { idGenerator: sequentialIdGenerator() })

  // Ground truth from the file itself:
  //   60 bold INT/EXT scene headings, 64 act/scene (##/###) headings,
  //   roughly 790 bold character cues, 15 full-line italic parentheticals.
  it('finds every scene heading despite the bold markers', () => {
    const headings = script.elements.filter((e) => e.type === 'scene_heading')
    expect(headings.length).toBe(60)
    expect(headings[0]!.text).toBe('INT. SAINT MERCY HOSPITAL - ONCOLOGY WING - DAY')
  })

  it('maps # act and scene headings to sections with depth', () => {
    const sections = script.elements.filter((e) => e.type === 'section')
    expect(sections.length).toBe(64)
    expect(sections.some((s) => s.text === 'ACT ONE' && s.depth === 2)).toBe(true)
    expect(sections.some((s) => /^SCENE 1$/.test(s.text) && s.depth === 3)).toBe(true)
  })

  it('finds the character cues and parentheticals', () => {
    const cues = script.elements.filter((e) => e.type === 'character').length
    expect(cues).toBeGreaterThanOrEqual(700)
    const parens = script.elements.filter((e) => e.type === 'parenthetical').length
    expect(parens).toBeGreaterThanOrEqual(15)
  })

  it('routes the front matter to the title page', () => {
    const get = (key: string) => script.titlePage.find((e) => e.key === key)?.values
    expect(get('Title')?.[0]).toBe('EL AHOGADO')
    expect(get('Credit')).toEqual(['Written by'])
    expect(get('Source')?.[0]).toMatch(/^Based on/i)
    expect(script.elements.some((e) => /^written by$/i.test(e.text))).toBe(false)
  })

  it('leaves no markdown syntax in the imported script', () => {
    for (const el of script.elements) {
      expect(el.text, `${el.type}: ${el.text.slice(0, 50)}`).not.toMatch(/\*\*|^---/)
    }
  })

  it('paginates to a sensible feature length', () => {
    const pages = paginate(script).length
    // The file says "approximately 105 minutes"; anywhere near feature
    // length is sane, one 87-page action blob is not.
    expect(pages).toBeGreaterThanOrEqual(80)
    expect(pages).toBeLessThanOrEqual(190)
    expect(script.elements.filter((e) => e.type === 'action').length).toBeGreaterThan(100)
  })

  it('flags only a small share of lines as doubtful', () => {
    const content = lines.filter((l) => l.type !== 'blank')
    const doubtful = content.filter((l) => l.confidence < 0.7)
    expect(doubtful.length / content.length).toBeLessThan(0.1)
  })
})
