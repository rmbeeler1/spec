import type { ElementType } from '@spec/core'
import { CYCLE_TYPES } from './schema'

/**
 * The keyboard model, as pure functions so it can be unit tested without a
 * DOM. The editor extension wires these into Tiptap.
 */

/** What a fresh element becomes after pressing Enter at the end of a type. */
export function nextTypeOnEnter(current: ElementType): ElementType {
  switch (current) {
    case 'scene_heading':
      return 'action'
    case 'character':
      return 'dialogue'
    case 'parenthetical':
      return 'dialogue'
    case 'dialogue':
      return 'character'
    case 'transition':
      return 'scene_heading'
    default:
      return 'action'
  }
}

/** Tab cycles the current element through the main screenplay types. */
export function cycleType(current: ElementType, backwards = false): ElementType {
  const idx = CYCLE_TYPES.indexOf(current)
  if (idx === -1) return 'action'
  const delta = backwards ? -1 : 1
  return CYCLE_TYPES[(idx + delta + CYCLE_TYPES.length) % CYCLE_TYPES.length]!
}

const SCENE_HEADING_RE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i

/**
 * Auto element detection, applied to the line just finished when the writer
 * presses Enter. Only ever upgrades plain action lines, so manually chosen
 * types are never overridden.
 */
export function detectTypeOnEnter(text: string, current: ElementType): ElementType {
  const t = text.trim()
  if (t.length === 0) return current

  if (current === 'action') {
    if (SCENE_HEADING_RE.test(t)) return 'scene_heading'
    const isCaps = t === t.toUpperCase() && /[A-Z]/.test(t)
    if (isCaps && t.endsWith('TO:')) return 'transition'
    // A short caps line is almost always a character cue about to speak
    if (isCaps && t.length <= 30 && !/[.!?]$/.test(t)) return 'character'
  }
  if (current === 'dialogue' && t.startsWith('(') && t.endsWith(')')) return 'parenthetical'
  return current
}

/** Keyboard shortcuts CmdOrCtrl+1..6 map straight to element types. */
export function typeForShortcut(digit: number): ElementType | null {
  return CYCLE_TYPES[digit - 1] ?? null
}
