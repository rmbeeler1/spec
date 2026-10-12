/**
 * Fountain inline emphasis: *italic*, **bold**, ***bold italic***,
 * _underline_. Notes ([[...]]) are stripped: they never render.
 * Emphasis does not span line breaks.
 */

export interface StyleSpan {
  start: number
  end: number // exclusive, offsets into the plain text
  bold: boolean
  italic: boolean
  underline: boolean
}

export interface StyledText {
  text: string
  spans: StyleSpan[]
}

interface Style {
  bold: boolean
  italic: boolean
  underline: boolean
}

const ESCAPED_STAR = '\u0001'
const ESCAPED_UNDERSCORE = '\u0002'

export function parseEmphasis(raw: string): StyledText {
  const noNotes = raw.replace(/\[\[[\s\S]*?\]\]/g, '')
  const lines = noNotes.split('\n')
  let text = ''
  const spans: StyleSpan[] = []

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) text += '\n'
    const escaped = lines[i]!.replace(/\\\*/g, ESCAPED_STAR).replace(/\\_/g, ESCAPED_UNDERSCORE)
    const offset = text.length
    const plain = walk(escaped, { bold: false, italic: false, underline: false }, offset, spans)
    text += plain.replace(new RegExp(ESCAPED_STAR, 'g'), '*').replace(new RegExp(ESCAPED_UNDERSCORE, 'g'), '_')
  }
  return { text, spans }
}

const PATTERNS: Array<{ re: RegExp; style: Partial<Style> }> = [
  { re: /\*\*\*(\S(?:[^*]*?\S)?)\*\*\*/, style: { bold: true, italic: true } },
  { re: /\*\*(\S(?:[^*]*?\S)?)\*\*/, style: { bold: true } },
  { re: /\*(\S(?:[^*]*?\S)?)\*/, style: { italic: true } },
  { re: /_(\S(?:[^_]*?\S)?)_/, style: { underline: true } }
]

function walk(segment: string, style: Style, offset: number, spans: StyleSpan[]): string {
  // Find the earliest emphasis marker; longer markers win at the same spot
  let best: { index: number; length: number; inner: string; style: Partial<Style> } | null = null
  for (const p of PATTERNS) {
    const m = segment.match(p.re)
    if (m && m.index !== undefined) {
      if (best === null || m.index < best.index) {
        best = { index: m.index, length: m[0].length, inner: m[1]!, style: p.style }
      }
    }
  }

  if (best === null) {
    if (style.bold || style.italic || style.underline) {
      if (segment.length > 0) {
        spans.push({ start: offset, end: offset + segment.length, ...style })
      }
    }
    return segment
  }

  const before = segment.slice(0, best.index)
  const after = segment.slice(best.index + best.length)
  let out = ''
  out += walk(before, style, offset, spans)
  out += walk(best.inner, { ...style, ...best.style }, offset + out.length, spans)
  out += walk(after, style, offset + out.length, spans)
  return out
}

/** Spans that overlap one wrapped line, re-based to that line's offsets. */
export function spansForRange(spans: StyleSpan[], start: number, end: number): StyleSpan[] {
  const out: StyleSpan[] = []
  for (const s of spans) {
    const a = Math.max(s.start, start)
    const b = Math.min(s.end, end)
    if (a < b) {
      out.push({ start: a - start, end: b - start, bold: s.bold, italic: s.italic, underline: s.underline })
    }
  }
  return out
}
