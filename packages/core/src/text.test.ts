import { describe, expect, it } from 'vitest'
import { normalizeLineEndings, splitLines } from './text'

describe('normalizeLineEndings', () => {
  it('converts Windows line endings', () => {
    expect(normalizeLineEndings('INT. HOUSE - DAY\r\n\r\nAction.')).toBe(
      'INT. HOUSE - DAY\n\nAction.'
    )
  })

  it('converts old Mac line endings', () => {
    expect(normalizeLineEndings('one\rtwo')).toBe('one\ntwo')
  })

  it('leaves Unix line endings alone', () => {
    expect(normalizeLineEndings('one\ntwo')).toBe('one\ntwo')
  })
})

describe('splitLines', () => {
  it('splits mixed line endings into lines', () => {
    expect(splitLines('a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps trailing empty lines', () => {
    expect(splitLines('a\n\n')).toEqual(['a', '', ''])
  })
})
