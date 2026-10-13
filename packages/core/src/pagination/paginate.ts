import type { ElementType, Script, ScriptElement } from '../model/types'
import { parseEmphasis, spansForRange, type StyleSpan } from '../text/emphasis'
import { DEFAULT_PAGINATION, type PaginationConfig } from './config'

export type RenderLineType = ElementType | 'more' | 'blank'

export interface RenderLine {
  /** The element this line came from; null for blanks and (MORE). */
  elementId: string | null
  type: RenderLineType
  text: string // plain text, emphasis markers and notes stripped
  indent: number // characters from the left margin
  spans: StyleSpan[]
  /** Scene headings only: the scene number, printed in both margins. */
  sceneNumber?: string
}

export interface RenderPage {
  lines: RenderLine[]
}

/** Elements that never appear on a script page. */
const INVISIBLE: ReadonlySet<ElementType> = new Set(['section', 'synopsis', 'note', 'boneyard'])

export function paginate(script: Script, partial: Partial<PaginationConfig> = {}): RenderPage[] {
  const config: PaginationConfig = {
    ...DEFAULT_PAGINATION,
    ...partial,
    indents: { ...DEFAULT_PAGINATION.indents, ...partial.indents },
    widths: { ...DEFAULT_PAGINATION.widths, ...partial.widths },
    blankLinesBefore: { ...DEFAULT_PAGINATION.blankLinesBefore, ...partial.blankLinesBefore }
  }

  const blocks = buildBlocks(script, config)
  return fillPages(blocks, config)
}

// ---------------------------------------------------------------------------
// Blocks: units the page filler places, with keep-together rules
// ---------------------------------------------------------------------------

type BlockKind = 'heading' | 'dialogue' | 'flow' | 'transition' | 'forced_break'

interface DialogueLine extends RenderLine {
  role: 'cue' | 'parenthetical' | 'dialogue'
}

interface Block {
  kind: BlockKind
  lines: RenderLine[]
  blanksBefore: number
  /** dialogue blocks only: the cue text, used for (CONT'D) on page breaks. */
  cueText?: string
}

function buildBlocks(script: Script, config: PaginationConfig): Block[] {
  const blocks: Block[] = []
  const els = script.elements
  let i = 0
  while (i < els.length) {
    const el = els[i]!
    if (INVISIBLE.has(el.type)) {
      i++
      continue
    }
    if (el.type === 'page_break') {
      blocks.push({ kind: 'forced_break', lines: [], blanksBefore: 0 })
      i++
      continue
    }
    if (el.type === 'character') {
      const lines: DialogueLine[] = []
      const cue = renderElement(el, config)
      for (const l of cue) lines.push({ ...l, role: 'cue' })
      let j = i + 1
      while (j < els.length) {
        const child = els[j]!
        if (child.type === 'parenthetical') {
          for (const l of renderElement(child, config)) lines.push({ ...l, role: 'parenthetical' })
        } else if (child.type === 'dialogue' || child.type === 'lyric') {
          for (const l of renderElement(child, config)) lines.push({ ...l, role: 'dialogue' })
        } else {
          break
        }
        j++
      }
      blocks.push({
        kind: 'dialogue',
        lines,
        blanksBefore: config.blankLinesBefore.character ?? 1,
        cueText: parseEmphasis(el.text).text
      })
      i = j
      continue
    }

    const kind: BlockKind =
      el.type === 'scene_heading' ? 'heading' : el.type === 'transition' ? 'transition' : 'flow'
    blocks.push({
      kind,
      lines: renderElement(el, config),
      blanksBefore: config.blankLinesBefore[el.type] ?? 1
    })
    i++
  }
  return blocks
}

/** Wrap one element into render lines. */
function renderElement(el: ScriptElement, config: PaginationConfig): RenderLine[] {
  const { text: plain, spans } = parseEmphasis(el.text)
  const width = config.widths[el.type] ?? 60
  const baseIndent = config.indents[el.type] ?? 0
  const lines: RenderLine[] = []

  let offset = 0
  for (const sourceLine of plain.split('\n')) {
    const wrapped = wrapLine(sourceLine, width)
    for (const [start, end] of wrapped) {
      const text = sourceLine.slice(start, end)
      let indent = baseIndent
      if (el.type === 'centered') {
        indent = Math.max(0, Math.floor((60 - text.length) / 2))
      } else if (el.type === 'transition') {
        indent = Math.max(0, 60 - text.length)
      }
      lines.push({
        elementId: el.id,
        type: el.type,
        text,
        indent,
        spans: spansForRange(spans, offset + start, offset + end)
      })
    }
    offset += sourceLine.length + 1
  }
  if (lines.length === 0) {
    lines.push({ elementId: el.id, type: el.type, text: '', indent: baseIndent, spans: [] })
  }
  if (el.type === 'scene_heading' && el.sceneNumber) {
    lines[0]!.sceneNumber = el.sceneNumber
  }
  return lines
}

/** Greedy word wrap. Returns [start, end) offsets into the line. */
export function wrapLine(line: string, width: number): Array<[number, number]> {
  const trimmedEnd = line.replace(/\s+$/, '')
  if (trimmedEnd.length <= width) return [[0, trimmedEnd.length]]

  const out: Array<[number, number]> = []
  let start = 0
  while (trimmedEnd.length - start > width) {
    let breakAt = -1
    for (let k = start + width; k > start; k--) {
      if (trimmedEnd[k] === ' ') {
        breakAt = k
        break
      }
    }
    if (breakAt === -1) breakAt = start + width // a word longer than the line
    out.push([start, breakAt])
    start = breakAt
    while (trimmedEnd[start] === ' ') start++
  }
  out.push([start, trimmedEnd.length])
  return out
}

// ---------------------------------------------------------------------------
// Page filling
// ---------------------------------------------------------------------------

function fillPages(blocks: Block[], config: PaginationConfig): RenderPage[] {
  const pages: RenderPage[] = []
  let current: RenderLine[] = []

  const used = (): number => current.length
  const room = (): number => config.linesPerPage - used()
  const newPage = (): void => {
    pages.push({ lines: current })
    current = []
  }
  const pushBlank = (count: number): void => {
    if (used() === 0) return // never start a page with blank lines
    for (let k = 0; k < count; k++) {
      current.push({ elementId: null, type: 'blank', text: '', indent: 0, spans: [] })
    }
  }

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b]!

    if (block.kind === 'forced_break') {
      if (used() > 0) newPage()
      continue
    }

    const blanks = used() === 0 ? 0 : block.blanksBefore

    if (block.kind === 'heading') {
      // A scene heading must bring the first line of what follows with it
      const next = blocks[b + 1]
      const needed = blanks + block.lines.length + (next ? minimumFirstChunk(next, config) : 0)
      if (needed > room() && used() > 0) newPage()
      pushBlank(used() === 0 ? 0 : blanks)
      current.push(...block.lines)
      continue
    }

    if (block.kind === 'transition') {
      if (blanks + block.lines.length > room() && used() > 0) newPage()
      pushBlank(used() === 0 ? 0 : blanks)
      current.push(...block.lines)
      continue
    }

    if (block.kind === 'dialogue') {
      placeDialogue(block, blanks)
      continue
    }

    // Flow blocks (action, centered, lyric, shot): split at any line boundary
    let lines = block.lines
    let first = true
    while (lines.length > 0) {
      const blanksNow = used() === 0 ? 0 : first ? blanks : 0
      const available = room() - blanksNow
      if (available < 1) {
        newPage()
        first = false
        continue
      }
      pushBlank(blanksNow)
      const take = Math.min(lines.length, room())
      current.push(...lines.slice(0, take))
      lines = lines.slice(take)
      first = false
      if (lines.length > 0) newPage()
    }
  }

  if (current.length > 0 || pages.length === 0) pages.push({ lines: current })
  return pages

  function placeDialogue(block: Block, blanks: number): void {
    let lines = block.lines as DialogueLine[]
    let cueText = block.cueText ?? ''
    let isContinuation = false

    for (;;) {
      const blanksNow = used() === 0 ? 0 : isContinuation ? 0 : blanks
      const available = room() - blanksNow

      if (lines.length <= available) {
        pushBlank(blanksNow)
        current.push(...lines)
        return
      }

      // Does a legal split fit on this page? Reserve one line for (MORE).
      const splitAt = findDialogueSplit(lines, available - 1, config)
      if (splitAt === -1) {
        if (used() === 0) {
          // Block alone on an empty page and still unsplittable low enough:
          // force a split at whatever fits to avoid an infinite loop.
          const forced = Math.max(1, available - 1)
          emitSplit(lines, forced)
          lines = lines.slice(forced)
          cueText = baseCue(cueText)
          isContinuation = true
          newPage()
          lines = withContinuedCue(lines, cueText, config)
          continue
        }
        newPage()
        isContinuation = false
        continue
      }

      pushBlank(blanksNow)
      emitSplit(lines, splitAt)
      lines = lines.slice(splitAt)
      cueText = baseCue(cueText)
      newPage()
      lines = withContinuedCue(lines, cueText, config)
      isContinuation = true
    }
  }

  function emitSplit(lines: DialogueLine[], splitAt: number): void {
    current.push(...lines.slice(0, splitAt))
    current.push({
      elementId: null,
      type: 'more',
      text: '(MORE)',
      indent: config.indents.character ?? 22,
      spans: []
    })
  }
}

/** Strip an existing (CONT'D) so continuations do not stack them. */
function baseCue(cue: string): string {
  return cue.replace(/\s*\(CONT'D\)\s*$/i, '')
}

function withContinuedCue(
  rest: DialogueLine[],
  cueText: string,
  config: PaginationConfig
): DialogueLine[] {
  const cue: DialogueLine = {
    elementId: null,
    type: 'character',
    role: 'cue',
    text: `${cueText} (CONT'D)`,
    indent: config.indents.character ?? 22,
    spans: []
  }
  return [cue, ...rest]
}

/**
 * Find how many lines of a dialogue block can stay on this page, breaking
 * only between dialogue lines: never right after the cue or a parenthetical,
 * and keeping the configured minimum dialogue lines on both sides.
 */
function findDialogueSplit(
  lines: DialogueLine[],
  maxLines: number,
  config: PaginationConfig
): number {
  for (let k = Math.min(maxLines, lines.length - 1); k >= 1; k--) {
    const before = lines[k - 1]!
    const after = lines[k]!
    if (before.role !== 'dialogue') continue
    if (after.role === 'parenthetical') continue // do not open a page with one
    const dialogueBefore = lines.slice(0, k).filter((l) => l.role === 'dialogue').length
    const dialogueAfter = lines.slice(k).filter((l) => l.role === 'dialogue').length
    if (dialogueBefore < config.minDialogueLinesBeforeBreak) return -1
    if (dialogueAfter < config.minDialogueLinesAfterBreak) continue
    return k
  }
  return -1
}

/** The fewest lines a block may contribute to the bottom of a page. */
function minimumFirstChunk(block: Block, config: PaginationConfig): number {
  const gap = block.kind === 'forced_break' ? 0 : block.blanksBefore
  if (block.kind === 'dialogue') {
    // cue plus the minimum dialogue lines before any break
    const nonCue = Math.min(
      block.lines.length - 1,
      config.minDialogueLinesBeforeBreak + (block.lines[1]?.type === 'parenthetical' ? 1 : 0)
    )
    return gap + 1 + nonCue
  }
  if (block.kind === 'forced_break') return 0
  return gap + Math.min(block.lines.length, 1)
}
