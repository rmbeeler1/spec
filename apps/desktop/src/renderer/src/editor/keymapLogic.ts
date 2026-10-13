import { baseCharacterName, type ElementType } from '@spec/core'
import { CYCLE_TYPES } from './schema'

// The canonical implementation lives in core (planning stats use it too)
export { baseCharacterName }

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

/**
 * Structure markers typed by hand: "# Act One" becomes a section (depth from
 * the number of #s), "= She leaves." a synopsis. The marker is stripped from
 * the stored text, exactly as parsing a Fountain file would. Only plain
 * action lines convert, so chosen types are never overridden.
 */
export function detectStructure(
  text: string,
  current: ElementType
): { type: 'section'; depth: number; text: string } | { type: 'synopsis'; text: string } | null {
  if (current !== 'action') return null
  const section = text.match(/^(#{1,6})\s+(.+)$/)
  if (section) return { type: 'section', depth: section[1]!.length, text: section[2]!.trim() }
  const synopsis = text.match(/^=\s+(.+)$/)
  if (synopsis && !text.startsWith('==')) return { type: 'synopsis', text: synopsis[1]!.trim() }
  return null
}

/** Keyboard shortcuts CmdOrCtrl+1..6 map straight to element types. */
export function typeForShortcut(digit: number): ElementType | null {
  return CYCLE_TYPES[digit - 1] ?? null
}

/**
 * Tidy a scene heading when the writer finishes it: make sure the INT/EXT
 * prefix is uppercase and carries its period ("int house - day" becomes
 * "INT. house - day"; display and print uppercase the rest).
 */
export function normalizeSceneHeading(text: string): string {
  const m = text.match(/^(\s*)(INT\.?\/EXT|INT|EXT|EST|I\/E)([.\s])\s*(.*)$/i)
  if (!m) return text
  const prefix = m[2]!.toUpperCase().replace(/\.$/, '').replace('INT/EXT', 'INT./EXT')
  return `${prefix}. ${m[4] ?? ''}`.trimEnd()
}

/**
 * Should this character cue get a (CONT'D)? Yes when the most recent speaker
 * before it is the same character and only action (or similar) stands in
 * between. A scene heading or transition resets the conversation.
 */
export function needsContd(
  previousElements: Array<{ type: ElementType; text: string }>,
  cueText: string
): boolean {
  if (/\(CONT'D\)\s*\^?\s*$/i.test(cueText)) return false
  const name = baseCharacterName(cueText)
  if (name.length === 0) return false

  let sawInterruption = false
  for (let i = previousElements.length - 1; i >= 0; i--) {
    const el = previousElements[i]!
    if (el.type === 'character') {
      return sawInterruption && baseCharacterName(el.text) === name
    }
    if (el.type === 'scene_heading' || el.type === 'transition' || el.type === 'page_break') {
      return false
    }
    if (el.type === 'action' || el.type === 'centered' || el.type === 'shot') {
      sawInterruption = true
    }
    // dialogue/parenthetical/lyric: part of the previous speech, keep walking
  }
  return false
}

/** Append (CONT'D), keeping a dual-dialogue caret at the very end. */
export function withContd(cueText: string): string {
  const dual = /\^\s*$/.test(cueText.trim())
  const base = cueText.trim().replace(/\^\s*$/, '').trimEnd()
  return `${base} (CONT'D)${dual ? ' ^' : ''}`
}
