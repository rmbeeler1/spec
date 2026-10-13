import { describe, expect, it } from 'vitest'
import { parseFountain } from '../fountain/parse'
import { sequentialIdGenerator } from '../model/ids'
import { renameCharacterInScript, renameCue, renameInProse } from './rename'

describe('renameCue', () => {
  it('replaces the name, keeping extensions and the dual caret', () => {
    expect(renameCue('MAYA', 'MAYA', 'Sarah')).toBe('SARAH')
    expect(renameCue("MAYA (CONT'D)", 'MAYA', 'Sarah')).toBe("SARAH (CONT'D)")
    expect(renameCue('MAYA (V.O.) ^', 'MAYA', 'Sarah')).toBe('SARAH (V.O.) ^')
    expect(renameCue('maya (quietly)', 'MAYA', 'Sarah')).toBe('SARAH (quietly)')
  })

  it('leaves other characters alone', () => {
    expect(renameCue('SCOTT', 'MAYA', 'Sarah')).toBe('SCOTT')
    expect(renameCue('MAYA JONES', 'MAYA', 'Sarah')).toBe('MAYA JONES')
  })

  it('handles multi-word names', () => {
    expect(renameCue('MRS. SMITH (O.S.)', 'MRS. SMITH', 'Dr. Jones')).toBe('DR. JONES (O.S.)')
  })
})

describe('renameInProse', () => {
  it('replaces whole words, preserving the casing style of each mention', () => {
    expect(renameInProse('MAYA enters. Maya smiles at maya.', 'MAYA', 'Sarah')).toBe(
      'SARAH enters. Sarah smiles at Sarah.'
    )
  })

  it('never touches substrings', () => {
    expect(renameInProse('The Mayan ruins. AMAYA waits.', 'MAYA', 'Sarah')).toBe(
      'The Mayan ruins. AMAYA waits.'
    )
  })

  it('handles names at line edges and punctuation', () => {
    expect(renameInProse('Maya? Maya! (Maya)', 'MAYA', 'Sarah')).toBe('Sarah? Sarah! (Sarah)')
    expect(renameInProse('Maya\nand Maya', 'MAYA', 'Sarah')).toBe('Sarah\nand Sarah')
  })
})

describe('renameCharacterInScript', () => {
  it('renames cues and mentions across element types, nothing else', () => {
    const script = parseFountain(
      [
        'INT. MAYA HOUSE - DAY',
        '',
        'MAYA enters, soaked.',
        '',
        'MAYA',
        '(to herself)',
        'Maya, get it together.',
        '',
        'SCOTT',
        'Maya? You alright?',
        ''
      ].join('\n'),
      { idGenerator: sequentialIdGenerator() }
    )
    const out = renameCharacterInScript(script, 'MAYA', 'Sarah')
    const texts = out.elements.map((e) => `${e.type}: ${e.text}`)
    expect(texts).toEqual([
      // Scene headings are untouched on purpose: locations are not people
      'scene_heading: INT. MAYA HOUSE - DAY',
      'action: SARAH enters, soaked.',
      'character: SARAH',
      'parenthetical: (to herself)',
      'dialogue: Sarah, get it together.',
      'character: SCOTT',
      'dialogue: Sarah? You alright?'
    ])
  })
})
