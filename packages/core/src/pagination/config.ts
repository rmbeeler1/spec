import type { ElementType } from '../model/types'

/**
 * Industry-standard layout: US Letter, Courier 12pt (10 characters per inch,
 * 6 lines per inch), 1.5 inch left margin, 1 inch right/top/bottom.
 * Indents are measured in characters from the 1.5 inch left margin.
 * Widths are maximum characters per line before wrapping.
 */
export interface PaginationConfig {
  linesPerPage: number
  indents: Partial<Record<ElementType, number>>
  widths: Partial<Record<ElementType, number>>
  blankLinesBefore: Partial<Record<ElementType, number>>
  /** Minimum dialogue lines that must sit on each side of a (MORE) break. */
  minDialogueLinesBeforeBreak: number
  minDialogueLinesAfterBreak: number
}

export const DEFAULT_PAGINATION: PaginationConfig = {
  linesPerPage: 55,
  indents: {
    scene_heading: 0,
    action: 0,
    character: 22, // 2.2" from the margin puts the cue at 3.7" absolute
    parenthetical: 16, // 3.1" absolute
    dialogue: 10, // 2.5" absolute
    transition: 45,
    centered: 0,
    lyric: 10,
    shot: 0
  },
  widths: {
    scene_heading: 60, // 6.0" of text at 10 cpi
    action: 60,
    character: 38,
    parenthetical: 29, // wraps before the dialogue right edge
    dialogue: 35, // 2.5" to 6.0" absolute
    transition: 15,
    centered: 60,
    lyric: 35,
    shot: 60
  },
  blankLinesBefore: {
    scene_heading: 2, // double space before scene headings, Final Draft default
    action: 1,
    character: 1,
    transition: 1,
    centered: 1,
    lyric: 1,
    shot: 1
  },
  minDialogueLinesBeforeBreak: 2,
  minDialogueLinesAfterBreak: 2
}
