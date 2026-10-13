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
  /** Locked pagination only: the page's production label ("12", "12A"). */
  label?: string
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

export interface PageLockAnchor {
  /** The locked page's label: "12" stays "12" forever. */
  page: string
  /** Element whose rendered line starts the locked page. */
  elementId: string
  /** Which of that element's rendered lines (0-based) starts the page. */
  lineOffset: number
}

/**
 * Lock the current pagination: remember, line-precisely, where every page
 * starts. A page that opens mid-speech (after a CONT'D cue) anchors to the
 * first continuation line of the dialogue element.
 */
export function lockPages(script: Script, partial: Partial<PaginationConfig> = {}): PageLockAnchor[] {
  const pages = paginate(script, partial)
  const seen = new Map<string, number>()
  const anchors: PageLockAnchor[] = []
  for (let p = 0; p < pages.length; p++) {
    let anchored = false
    for (const line of pages[p]!.lines) {
      if (!line.elementId) continue
      const offset = seen.get(line.elementId) ?? 0
      if (!anchored) {
        anchors.push({ page: String(p + 1), elementId: line.elementId, lineOffset: offset })
        anchored = true
      }
      seen.set(line.elementId, offset + 1)
    }
  }
  return anchors
}

/**
 * Paginate against locked pages. Forced breaks happen exactly at the locked
 * line anchors, so an unedited script reproduces its locked layout to the
 * line, (MORE)/(CONT'D) included. New material overflows into A-pages (12A,
 * 12B) instead of renumbering, and removed material leaves pages short.
 * Anchors whose element was cut or rewritten dissolve into the previous
 * page. Overflow pages break more simply than first-run pagination (they
 * avoid orphaned cues and bottom headings, but split flow text anywhere).
 */
export function paginateLocked(
  script: Script,
  anchors: PageLockAnchor[],
  partial: Partial<PaginationConfig> = {}
): RenderPage[] {
  const config: PaginationConfig = {
    ...DEFAULT_PAGINATION,
    ...partial,
    indents: { ...DEFAULT_PAGINATION.indents, ...partial.indents },
    widths: { ...DEFAULT_PAGINATION.widths, ...partial.widths },
    blankLinesBefore: { ...DEFAULT_PAGINATION.blankLinesBefore, ...partial.blankLinesBefore }
  }
  const present = new Set(script.elements.map((e) => e.id))
  const locks = anchors.filter((a) => present.has(a.elementId))
  if (locks.length === 0) return paginate(script, partial)

  const blocks = buildBlocks(script, config)
  const pages: RenderPage[] = []
  let current: RenderLine[] = []
  let label = locks[0]!.page
  let overflow = 0
  let lockIdx = 0
  const emitted = new Map<string, number>() // content lines emitted per element

  const letterFor = (n: number): string => {
    let s = ''
    n += 1
    while (n > 0) {
      n--
      s = String.fromCharCode(65 + (n % 26)) + s
      n = Math.floor(n / 26)
    }
    return s
  }

  const closePage = (): void => {
    pages.push({ lines: current, label })
    current = []
  }

  const startLockedPage = (page: string): void => {
    if (current.length > 0) closePage()
    label = page
    overflow = 0
  }

  const startOverflowPage = (): void => {
    closePage()
    label = `${label.replace(/[A-Z]+$/, '')}${letterFor(overflow)}`
    overflow++
  }

  const pushBlanks = (count: number): void => {
    if (current.length === 0) return
    for (let k = 0; k < count; k++) {
      current.push({ elementId: null, type: 'blank', text: '', indent: 0, spans: [] })
    }
  }

  /** Emit one content line, honoring lock points and the page height. */
  const emit = (
    line: RenderLine,
    blanksBefore: number,
    midBlock: boolean,
    dialogue?: { cueText: string }
  ): void => {
    if (line.elementId) {
      const offset = emitted.get(line.elementId) ?? 0
      const lock = locks[lockIdx]
      if (lock && lock.elementId === line.elementId && lock.lineOffset === offset) {
        lockIdx++
        if (dialogue && midBlock && current.length > 0) {
          // The locked layout split this speech here: recreate (MORE) and
          // the CONT'D cue exactly as the original pagination printed them
          current.push({
            elementId: null,
            type: 'more',
            text: '(MORE)',
            indent: config.indents.character ?? 22,
            spans: []
          })
          startLockedPage(lock.page)
          current.push({
            elementId: null,
            type: 'character',
            text: `${dialogue.cueText.replace(/\s*\(CONT'D\)\s*$/i, '')} (CONT'D)`,
            indent: config.indents.character ?? 22,
            spans: []
          })
        } else {
          startLockedPage(lock.page)
        }
        blanksBefore = 0
      }
      emitted.set(line.elementId, offset + 1)
    }
    if (current.length + blanksBefore + 1 > config.linesPerPage) {
      // Overflow onto an A-page; never leave a cue or heading stranded
      if (dialogue && midBlock) {
        const last = current[current.length - 1]
        let cueIdx = -1
        for (let k = current.length - 1; k >= 0; k--) {
          if (current[k]!.type === 'character') {
            cueIdx = k
            break
          }
        }
        if (last && (last.type === 'character' || last.type === 'parenthetical') && cueIdx !== -1) {
          // Never strand a cue (or its parenthetical) at a page bottom
          const carried = current.splice(cueIdx, current.length)
          startOverflowPage()
          current.push(...carried)
        } else {
          // The page is full mid-speech: the last dialogue line yields its
          // row to (MORE) and continues overleaf under a CONT'D cue
          const carried: RenderLine[] = []
          const lastLine = current[current.length - 1]
          if (lastLine && (lastLine.type === 'dialogue' || lastLine.type === 'lyric')) {
            carried.push(current.pop()!)
          }
          current.push({
            elementId: null,
            type: 'more',
            text: '(MORE)',
            indent: config.indents.character ?? 22,
            spans: []
          })
          startOverflowPage()
          current.push({
            elementId: null,
            type: 'character',
            text: `${dialogue.cueText.replace(/\s*\(CONT'D\)\s*$/i, '')} (CONT'D)`,
            indent: config.indents.character ?? 22,
            spans: []
          })
          current.push(...carried)
        }
      } else {
        const last = current[current.length - 1]
        if (last && last.type === 'scene_heading') {
          current.pop()
          startOverflowPage()
          current.push(last)
        } else {
          startOverflowPage()
        }
      }
      blanksBefore = 0
    }
    pushBlanks(blanksBefore)
    current.push(line)
  }

  for (const block of blocks) {
    if (block.kind === 'forced_break') {
      if (current.length > 0) startOverflowPage()
      continue
    }
    const isDialogue = block.kind === 'dialogue'
    const cue = isDialogue ? { cueText: block.cueText ?? '' } : undefined
    block.lines.forEach((line, i) => {
      emit(line, i === 0 ? block.blanksBefore : 0, i > 0, cue)
    })
  }
  if (current.length > 0 || pages.length === 0) closePage()
  return pages
}

// ---------------------------------------------------------------------------
// Blocks: units the page filler places, with keep-together rules
// ---------------------------------------------------------------------------

type BlockKind = 'heading' | 'dialogue' | 'dual' | 'flow' | 'transition' | 'forced_break'

// Dual dialogue geometry within the 60-character text column
const DUAL_COL_WIDTH = 28
const DUAL_RIGHT_START = 32
const DUAL_CUE_OFFSET = 9
const DUAL_PAREN_OFFSET = 4

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

      // A following speech whose cue carries ^ pairs up side by side
      if (j < els.length && els[j]!.type === 'character' && els[j]!.dual === true) {
        let k = j + 1
        while (
          k < els.length &&
          (els[k]!.type === 'parenthetical' ||
            els[k]!.type === 'dialogue' ||
            els[k]!.type === 'lyric')
        ) {
          k++
        }
        blocks.push({
          kind: 'dual',
          lines: renderDualBlock(els.slice(i, j), els.slice(j, k)),
          blanksBefore: config.blankLinesBefore.character ?? 1
        })
        i = k
        continue
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

/** One column of a dual-dialogue pair: wrapped plain lines with offsets. */
function renderDualColumn(els: ScriptElement[]): Array<{ text: string; offset: number }> {
  const out: Array<{ text: string; offset: number }> = []
  for (const el of els) {
    const offset =
      el.type === 'character'
        ? DUAL_CUE_OFFSET
        : el.type === 'parenthetical'
          ? DUAL_PAREN_OFFSET
          : 0
    const { text: plain } = parseEmphasis(el.text)
    for (const sourceLine of plain.split('\n')) {
      for (const [start, end] of wrapLine(sourceLine, DUAL_COL_WIDTH - offset)) {
        out.push({ text: sourceLine.slice(start, end), offset })
      }
    }
  }
  return out
}

/**
 * Two speeches as side-by-side columns. Each output line is plain text with
 * both columns baked in (left at 0, right at DUAL_RIGHT_START), so the page
 * filler and the PDF treat it like any other line. Emphasis inside dual
 * dialogue is dropped; the columns are the point.
 */
function renderDualBlock(left: ScriptElement[], right: ScriptElement[]): RenderLine[] {
  const l = renderDualColumn(left)
  const r = renderDualColumn(right)
  const rows = Math.max(l.length, r.length)
  const lines: RenderLine[] = []
  for (let i = 0; i < rows; i++) {
    const lt = l[i] ? ' '.repeat(l[i]!.offset) + l[i]!.text : ''
    const rt = r[i] ? ' '.repeat(r[i]!.offset) + r[i]!.text : ''
    const text = rt.length > 0 ? lt.padEnd(DUAL_RIGHT_START) + rt : lt
    lines.push({
      elementId: left[0]?.id ?? null,
      type: 'dialogue',
      text,
      indent: 0,
      spans: []
    })
  }
  return lines
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

    if (block.kind === 'dual') {
      // Dual pairs stay together; only a pair taller than a full page splits
      if (blanks + block.lines.length > room() && used() > 0 && block.lines.length <= config.linesPerPage) {
        newPage()
      }
      let lines = block.lines
      let first = true
      while (lines.length > 0) {
        const blanksNow = used() === 0 ? 0 : first ? blanks : 0
        if (room() - blanksNow < 1) {
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
