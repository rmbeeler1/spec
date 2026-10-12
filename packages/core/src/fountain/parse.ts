import type { Script, ScriptElement, TitlePageEntry } from '../model/types'
import { randomIdGenerator, type IdGenerator } from '../model/ids'
import { normalizeLineEndings } from '../text'

export interface ParseOptions {
  /** Inject a predictable generator in tests. Defaults to random IDs. */
  idGenerator?: IdGenerator
}

// Whole-line boneyard comments are swapped for placeholder lines during
// parsing. The marker uses a NUL character precisely because it can never
// appear in real script text.
// eslint-disable-next-line no-control-regex
const BONEYARD_PLACEHOLDER = /^\u0000BY(\d+)\u0000$/

function isBoneyardPlaceholder(line: string): boolean {
  return BONEYARD_PLACEHOLDER.test(line.trim())
}

/** Parse Fountain text into the document model. */
export function parseFountain(source: string, options: ParseOptions = {}): Script {
  const nextId = options.idGenerator ?? randomIdGenerator()
  const normalized = normalizeLineEndings(source)
  const { text, blocks: boneyardBlocks } = extractBoneyards(normalized)
  const lines = text.split('\n')

  const { titlePage, bodyStart } = parseTitlePage(lines)
  const elements: ScriptElement[] = []

  const push = (el: Omit<ScriptElement, 'id'>): void => {
    elements.push({ id: nextId(), ...el })
  }

  let i = bodyStart
  while (i < lines.length) {
    const line = lines[i]!
    const trimmed = line.trim()

    if (isBlankLine(line)) {
      i++
      continue
    }

    // Boneyard placeholder (a /* */ block that occupied whole lines)
    const boneyardMatch = trimmed.match(BONEYARD_PLACEHOLDER)
    if (boneyardMatch) {
      push({ type: 'boneyard', text: boneyardBlocks[Number(boneyardMatch[1])] ?? '' })
      i++
      continue
    }

    // Page break: a line of three or more equals signs
    if (/^={3,}\s*$/.test(trimmed)) {
      push({ type: 'page_break', text: '' })
      i++
      continue
    }

    // Section: one or more # at line start
    const sectionMatch = trimmed.match(/^(#{1,6})\s*(.*)$/)
    if (sectionMatch) {
      push({ type: 'section', text: sectionMatch[2]!, depth: sectionMatch[1]!.length })
      i++
      continue
    }

    // Synopsis: a single = at line start
    if (/^=(?!=)/.test(trimmed)) {
      push({ type: 'synopsis', text: trimmed.slice(1).trim() })
      i++
      continue
    }

    // Standalone note: [[ ... ]] occupying its own line(s)
    if (trimmed.startsWith('[[')) {
      const collected: string[] = []
      let j = i
      let closed = false
      while (j < lines.length) {
        collected.push(lines[j]!.trim())
        if (lines[j]!.includes(']]')) {
          closed = true
          break
        }
        j++
      }
      const joined = collected.join('\n')
      if (closed && joined.endsWith(']]')) {
        push({ type: 'note', text: joined.slice(2, -2).trim() })
        i = j + 1
        continue
      }
      // Unclosed: fall through and treat as action
    }

    // Centered: > text <
    if (trimmed.startsWith('>') && trimmed.endsWith('<') && trimmed.length > 1) {
      push({ type: 'centered', text: trimmed.slice(1, -1).trim() })
      i++
      continue
    }

    // Forced transition: > at line start
    if (trimmed.startsWith('>')) {
      push({ type: 'transition', text: trimmed.slice(1).trim(), forced: true })
      i++
      continue
    }

    // Lyric: ~ at line start
    if (trimmed.startsWith('~')) {
      push({ type: 'lyric', text: trimmed.slice(1) })
      i++
      continue
    }

    // Forced action: ! at line start (takes the rest of the block)
    if (trimmed.startsWith('!')) {
      const first = line.slice(line.indexOf('!') + 1)
      const rest = collectBlock(lines, i + 1)
      push({ type: 'action', text: [first, ...rest.lines].join('\n'), forced: true })
      i = rest.next
      continue
    }

    // Forced scene heading: . at line start (but not .. which is an ellipsis)
    if (trimmed.startsWith('.') && !trimmed.startsWith('..')) {
      const { text: headingText, sceneNumber } = splitSceneNumber(trimmed.slice(1).trim())
      push({ type: 'scene_heading', text: headingText, sceneNumber, forced: true })
      i++
      continue
    }

    // Boneyard placeholders count as blank context: comments are invisible,
    // so they must not stop the line after them from being a heading or cue.
    const contextBlank = (l: string): boolean => isBlankLine(l) || isBoneyardPlaceholder(l)
    const prevBlank = i === bodyStart || contextBlank(lines[i - 1]!)
    const nextLine = i + 1 < lines.length ? lines[i + 1]! : null
    const nextBlank = nextLine === null || contextBlank(nextLine)

    // Scene heading: blank line before and after, starts with INT/EXT/EST/I/E
    if (prevBlank && nextBlank && isSceneHeadingLine(trimmed)) {
      const { text: headingText, sceneNumber } = splitSceneNumber(trimmed)
      push({ type: 'scene_heading', text: headingText, sceneNumber })
      i++
      continue
    }

    // Transition: blank line before and after, all caps, ends with TO:
    if (prevBlank && nextBlank && isTransitionLine(trimmed)) {
      push({ type: 'transition', text: trimmed })
      i++
      continue
    }

    // Character cue: blank line before, non-blank after, uppercase.
    // @ forces a cue for names like McCLANE that fail the uppercase test.
    const forcedCharacter = trimmed.startsWith('@')
    if (prevBlank && nextLine !== null && !nextBlank) {
      const cueText = forcedCharacter ? trimmed.slice(1) : trimmed
      if (forcedCharacter || isCharacterLine(cueText)) {
        const dual = cueText.trimEnd().endsWith('^')
        const name = dual ? cueText.trimEnd().slice(0, -1).trim() : cueText.trim()
        push({
          type: 'character',
          text: name,
          ...(dual ? { dual: true } : {}),
          ...(forcedCharacter ? { forced: true } : {})
        })
        i = parseDialogueBlock(lines, i + 1, push)
        continue
      }
    }

    // Default: action. Consecutive non-blank lines form one element.
    const block = collectBlock(lines, i)
    push({ type: 'action', text: block.lines.join('\n') })
    i = block.next
  }

  return { titlePage, elements }
}

/**
 * Blank means empty or whitespace-only. A line of exactly two spaces is NOT
 * blank: Fountain uses it to hold a visually empty line inside dialogue.
 */
export function isBlankLine(line: string): boolean {
  return line.trim() === '' && line !== '  '
}

function isSceneHeadingLine(trimmed: string): boolean {
  return /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i.test(trimmed)
}

function isTransitionLine(trimmed: string): boolean {
  return trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.endsWith('TO:')
}

function isCharacterLine(text: string): boolean {
  let t = text.trim()
  if (t.endsWith('^')) t = t.slice(0, -1).trim()
  if (t.length === 0) return false
  // Drop parenthetical extensions like (V.O.) before testing the name
  const base = t.replace(/\([^)]*\)/g, '').trim()
  if (base.length === 0) return false
  if (!/[A-Z]/.test(base)) return false
  if (base !== base.toUpperCase()) return false
  // A name cannot be numbers and punctuation only
  if (!/[A-Z]/.test(base.replace(/[^A-Z]/gi, ''))) return false
  return true
}

function splitSceneNumber(text: string): { text: string; sceneNumber?: string } {
  const m = text.match(/^(.*?)\s*#([^\s#][^#]*)#\s*$/)
  if (m) return { text: m[1]!.trimEnd(), sceneNumber: m[2]! }
  return { text }
}

/** Collect consecutive non-blank lines starting at index `start`. */
function collectBlock(lines: string[], start: number): { lines: string[]; next: number } {
  const out: string[] = []
  let i = start
  while (i < lines.length && !isBlankLine(lines[i]!)) {
    // Stop if a boneyard placeholder interrupts the block
    if (isBoneyardPlaceholder(lines[i]!)) break
    out.push(lines[i]!.replace(/\s+$/, ''))
    i++
  }
  return { lines: out, next: i }
}

/**
 * After a character cue: parentheticals and dialogue until a blank line.
 * Consecutive dialogue lines merge into one element, preserving line breaks.
 */
function parseDialogueBlock(
  lines: string[],
  start: number,
  push: (el: Omit<ScriptElement, 'id'>) => void
): number {
  let i = start
  let dialogueRun: string[] = []

  const flush = (): void => {
    if (dialogueRun.length > 0) {
      push({ type: 'dialogue', text: dialogueRun.join('\n') })
      dialogueRun = []
    }
  }

  while (i < lines.length && !isBlankLine(lines[i]!)) {
    const trimmed = lines[i]!.trim()
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      flush()
      push({ type: 'parenthetical', text: trimmed })
    } else if (trimmed.startsWith('~')) {
      flush()
      push({ type: 'lyric', text: trimmed.slice(1) })
    } else if (lines[i] === '  ') {
      dialogueRun.push('')
    } else {
      dialogueRun.push(trimmed)
    }
    i++
  }
  flush()
  return i
}

/**
 * Title page: key colon value pairs at the very top, ending at the first
 * blank line. Continuation values are indented with a tab or 3+ spaces.
 */
function parseTitlePage(lines: string[]): { titlePage: TitlePageEntry[]; bodyStart: number } {
  const titlePage: TitlePageEntry[] = []
  if (lines.length === 0) return { titlePage, bodyStart: 0 }

  const firstMatch = lines[0]!.match(/^([A-Za-z][A-Za-z0-9 _-]*):(.*)$/)
  if (!firstMatch) return { titlePage, bodyStart: 0 }
  // A lone "SOMETHING:" line is probably a transition (CUT TO:), not a title
  // page. Only start a title page when the first key has an inline value or
  // an indented continuation line under it.
  const hasInlineValue = firstMatch[2]!.trim().length > 0
  const hasContinuation = lines.length > 1 && (/^\t/.test(lines[1]!) || /^ {3,}/.test(lines[1]!))
  if (!hasInlineValue && !hasContinuation) return { titlePage, bodyStart: 0 }

  let i = 0
  let current: TitlePageEntry | null = null
  while (i < lines.length) {
    const line = lines[i]!
    if (isBlankLine(line)) break
    const keyMatch = line.match(/^([A-Za-z][A-Za-z0-9 _-]*):(.*)$/)
    if (keyMatch && !/^\s/.test(line)) {
      current = { key: keyMatch[1]!, values: [] }
      titlePage.push(current)
      const inline = keyMatch[2]!.trim()
      if (inline.length > 0) current.values.push(inline)
    } else if (current && (/^\t/.test(line) || /^ {3,}/.test(line))) {
      current.values.push(line.trim())
    } else {
      // Not a valid title page line: no title page after all
      return { titlePage: [], bodyStart: 0 }
    }
    i++
  }
  return { titlePage, bodyStart: i }
}

/**
 * Remove boneyard comments. A comment that occupies whole lines becomes a
 * placeholder line so it survives as a boneyard element; a comment inside a
 * line is dropped from the text entirely.
 */
export function extractBoneyards(text: string): { text: string; blocks: string[] } {
  const blocks: string[] = []
  let out = ''
  let pos = 0
  const re = /\/\*([\s\S]*?)\*\//g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(0, m.index)
    const after = text.slice(m.index + m[0].length)
    const atLineStart = before.length === 0 || before.endsWith('\n')
    const atLineEnd = after.length === 0 || after.startsWith('\n')
    out += text.slice(pos, m.index)
    if (atLineStart && atLineEnd) {
      const content = m[1]!.replace(/^\n/, '').replace(/\n$/, '')
      out += `\u0000BY${blocks.length}\u0000`
      blocks.push(content)
    }
    pos = m.index + m[0].length
  }
  out += text.slice(pos)
  return { text: out, blocks }
}
