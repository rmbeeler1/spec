import { describe, expect, it } from 'vitest'
import { titlePageBlocks } from './titlePage'

describe('titlePageBlocks', () => {
  it('builds the standard centered block with spacer lines', () => {
    const blocks = titlePageBlocks([
      { key: 'Title', values: ['BIG FISH'] },
      { key: 'Credit', values: ['written by'] },
      { key: 'Author', values: ['John August'] },
      { key: 'Source', values: ['based on the novel by Daniel Wallace'] }
    ])
    expect(blocks.centered).toEqual([
      'BIG FISH',
      '',
      'written by',
      '',
      'John August',
      '',
      'based on the novel by Daniel Wallace'
    ])
  })

  it('strips emphasis markers from the title only', () => {
    const blocks = titlePageBlocks([
      { key: 'Title', values: ['_**BRICK & STEEL**_'] },
      { key: 'Author', values: ['Stu Maschwitz'] }
    ])
    expect(blocks.centered[0]).toBe('BRICK & STEEL')
  })

  it('matches keys case-insensitively and accepts Authors and Date variants', () => {
    const blocks = titlePageBlocks([
      { key: 'title', values: ['TEST'] },
      { key: 'authors', values: ['A. Writer', 'B. Writer'] },
      { key: 'date', values: ['1 Oct 2026'] }
    ])
    expect(blocks.centered).toEqual(['TEST', '', 'A. Writer', 'B. Writer'])
    expect(blocks.draft).toEqual(['1 Oct 2026'])
  })

  it('puts contact and copyright bottom left, draft date bottom right', () => {
    const blocks = titlePageBlocks([
      { key: 'Title', values: ['TEST'] },
      { key: 'Contact', values: ['writer@example.com', '555-0100'] },
      { key: 'Copyright', values: ['(c) 2026'] },
      { key: 'Draft date', values: ['First draft'] }
    ])
    expect(blocks.contact).toEqual(['writer@example.com', '555-0100', '(c) 2026'])
    expect(blocks.draft).toEqual(['First draft'])
  })

  it('returns empty blocks for an empty title page', () => {
    expect(titlePageBlocks([])).toEqual({ centered: [], contact: [], draft: [] })
  })
})
