import type { ElementType } from '../model/types'

/**
 * The element classifier for imported scripts (Word, plain text, PDF text).
 * Input is a list of lines, optionally with layout hints from the source
 * format. Output is a type and a confidence per line; the review pane sorts
 * doubtful lines first and lets the writer bulk-fix them.
 */

export interface ImportLine {
  text: string
  /** The source says this paragraph is centered. */
  centered?: boolean
  /** The source says this paragraph starts bold. */
  bold?: boolean
  /** Left indent as a fraction of the usable text width, 0..1. */
  indent?: number
}

export type ClassifiedType = ElementType | 'blank'

export interface ClassifiedLine {
  text: string
  type: ClassifiedType
  confidence: number // 0..1; below ~0.7 means "worth a human look"
  /** section lines only: heading depth. */
  depth?: number
}

const SCENE_RE = /^(INT\.?\/EXT|INT|EXT|EST|I\/E)[.\s]/i
const TRANSITION_TAIL_RE = /TO:$/
const STANDALONE_TRANSITIONS = /^(FADE (IN|OUT|TO BLACK)[.:]?|SMASH CUT[.:]?|CUT TO BLACK[.:]?)$/i

function isCaps(t: string): boolean {
  return t === t.toUpperCase() && /[A-Z]/.test(t)
}

function looksLikeCue(t: string): boolean {
  if (!isCaps(t)) return false
  const base = t.replace(/\([^)]*\)/g, '').replace(/\^\s*$/, '').trim()
  if (base.length === 0 || base.length > 40) return false
  if (!/[A-Z]/.test(base.replace(/[^A-Z]/gi, ''))) return false
  if (/[.!?]$/.test(base) && base.length > 12) return false // shouted action
  return true
}

export function classifyLines(lines: ImportLine[]): ClassifiedLine[] {
  const out: ClassifiedLine[] = []

  const textAt = (i: number): string => lines[i]?.text.trim() ?? ''
  const isBlankAt = (i: number): boolean => i < 0 || i >= lines.length || textAt(i) === ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const t = line.text.trim()
    if (t === '') {
      out.push({ text: '', type: 'blank', confidence: 1 })
      continue
    }

    const prevBlank = isBlankAt(i - 1)
    const nextBlank = isBlankAt(i + 1)
    const prevType = lastContentType(out)

    // Scene heading: the strongest signal there is
    if (SCENE_RE.test(t)) {
      out.push({ text: t, type: 'scene_heading', confidence: prevBlank ? 0.98 : 0.85 })
      continue
    }

    // Transition
    if ((isCaps(t) && TRANSITION_TAIL_RE.test(t)) || STANDALONE_TRANSITIONS.test(t)) {
      out.push({ text: t, type: 'transition', confidence: isCaps(t) ? 0.9 : 0.6 })
      continue
    }

    // Parenthetical inside a dialogue block
    if (t.startsWith('(') && t.endsWith(')') && (prevType === 'character' || prevType === 'dialogue')) {
      out.push({ text: t, type: 'parenthetical', confidence: 0.92 })
      continue
    }

    // Dialogue: anything directly under a cue or parenthetical
    if ((prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') && !isBlankAt(i - 1)) {
      let confidence = 0.85
      if (line.indent !== undefined && line.indent > 0.08 && line.indent < 0.45) confidence += 0.1
      out.push({ text: t, type: 'dialogue', confidence: Math.min(1, confidence) })
      continue
    }

    // Character cue: caps, short, something follows it
    if (looksLikeCue(t) && !nextBlank) {
      let confidence = prevBlank ? 0.8 : 0.55
      const next = textAt(i + 1)
      if (next !== '' && !isCaps(next)) confidence += 0.1
      if (line.centered === true) confidence += 0.1
      if (line.bold === true) confidence += 0.1 // sources that bold their cues
      if (line.indent !== undefined && line.indent > 0.2 && line.indent < 0.65) confidence += 0.1
      out.push({ text: t, type: 'character', confidence: Math.min(1, confidence) })
      continue
    }

    // Centered decorations like THE END
    if (line.centered === true && nextBlank && prevBlank) {
      out.push({ text: t, type: 'centered', confidence: 0.7 })
      continue
    }

    // Everything else is action; shouting caps action is still action
    out.push({ text: t, type: 'action', confidence: isCaps(t) ? 0.6 : 0.9 })
  }

  return out
}

function lastContentType(out: ClassifiedLine[]): ClassifiedType | null {
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]!.type !== 'blank') return out[i]!.type
  }
  return null
}
