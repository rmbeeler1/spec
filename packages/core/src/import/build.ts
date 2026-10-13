import type { Script, ScriptElement, TitlePageEntry } from '../model/types'
import { randomIdGenerator, type IdGenerator } from '../model/ids'
import type { ClassifiedLine } from './classifier'

/**
 * Assemble classified lines into a Script: consecutive action lines in one
 * blank-delimited block merge into one element, dialogue lines under a cue
 * merge into one dialogue element, blanks separate everything else.
 *
 * Action lines join with spaces, not line breaks: in every source this
 * importer sees (Word, PDF, plain text), a line break inside a paragraph is
 * a layout artifact of the source's page width, not something the writer
 * typed. Blank lines still separate paragraphs. Dialogue keeps its breaks,
 * since the paginator re-wraps it to dialogue width anyway.
 */
export function buildScript(
  classified: ClassifiedLine[],
  titlePage: TitlePageEntry[] = [],
  idGenerator?: IdGenerator
): Script {
  const nextId = idGenerator ?? randomIdGenerator()
  const elements: ScriptElement[] = []

  let i = 0
  while (i < classified.length) {
    const line = classified[i]!
    if (line.type === 'blank') {
      i++
      continue
    }
    if (line.type === 'action' || line.type === 'dialogue') {
      const type = line.type
      const parts = [line.text]
      let j = i + 1
      while (j < classified.length && classified[j]!.type === type) {
        parts.push(classified[j]!.text)
        j++
      }
      const text =
        type === 'action'
          ? parts.map((p) => p.trim()).join(' ').replace(/\s+/g, ' ').trim()
          : parts.join('\n')
      elements.push({ id: nextId(), type, text })
      i = j
      continue
    }
    const el: ScriptElement = { id: nextId(), type: line.type, text: line.text }
    if (line.type === 'section') el.depth = line.depth ?? 1
    elements.push(el)
    i++
  }

  return { titlePage, elements }
}

/**
 * Final Draft (and its imitators) export title pages as centered lines, not
 * "Key: value" pairs, and an unfilled template ships placeholder text like
 * "(Name of Project)". Given the first page's lines, recognize that shape,
 * route real values to title page entries, and drop the placeholders.
 * Returns null when the page does not look like a title page at all.
 */
export function extractFdTitlePage(pageLines: string[]): TitlePageEntry[] | null {
  const nonBlank = pageLines.map((l) => l.trim()).filter((l) => l.length > 0)
  if (nonBlank.length === 0 || nonBlank.length > 16) return null
  const sceneRe = /^(INT\.?\/EXT|INT|EXT|EST|I\/E)[.\s]/i
  if (nonBlank.some((l) => sceneRe.test(l))) return null
  const byIndex = nonBlank.findIndex((l) => /^(written\s+)?by$/i.test(l))
  if (byIndex === -1) return null

  // Template placeholders: parenthesized spans (possibly multi-line) and the
  // literal labels of the unfilled Final Draft template.
  const TEMPLATE_LITERALS =
    /^(revisions by|current revisions by|name \(of company, if applicable\)|address|phone number|draft date)$/i
  const kept: string[] = []
  let inParens = false
  for (const line of nonBlank) {
    if (inParens) {
      if (line.endsWith(')')) inParens = false
      continue
    }
    if (line.startsWith('(')) {
      if (!line.endsWith(')')) inParens = true
      continue
    }
    if (TEMPLATE_LITERALS.test(line)) continue
    kept.push(line)
  }

  const entries: TitlePageEntry[] = []
  const title: string[] = []
  const contact: string[] = []
  let credit: string | null = null
  let author: string | null = null
  let source: string | null = null

  for (const line of kept) {
    if (credit === null && /^(written\s+)?by$/i.test(line)) {
      credit = line
    } else if (credit === null) {
      title.push(line)
    } else if (author === null) {
      author = line
    } else if (source === null && /^based on/i.test(line)) {
      source = line
    } else {
      contact.push(line)
    }
  }

  if (title.length > 0) entries.push({ key: 'Title', values: title })
  if (credit !== null && author !== null) {
    entries.push({ key: 'Credit', values: [credit] })
    entries.push({ key: 'Author', values: [author] })
  }
  if (source !== null) entries.push({ key: 'Source', values: [source] })
  if (contact.length > 0) entries.push({ key: 'Contact', values: contact })
  return entries
}

/**
 * Pull a "Key: value" block off the top of an imported document and return
 * it as title page entries plus the remaining lines.
 */
export function extractTitlePage(lines: string[]): {
  titlePage: TitlePageEntry[]
  rest: string[]
} {
  const titlePage: TitlePageEntry[] = []
  let i = 0
  let current: TitlePageEntry | null = null

  const keyRe = /^([A-Za-z][A-Za-z0-9 _-]{0,24}):(.*)$/

  // Only treat it as a title page when the very first content line is a key
  // with an inline value, or a key whose values follow on indented lines
  // (same guard as the Fountain parser: a lone "CUT TO:" is a transition,
  // not a key).
  while (i < lines.length && lines[i]!.trim() === '') i++
  const first = lines[i]?.match(keyRe)
  const continuation = lines[i + 1] !== undefined && /^[\t ]+\S/.test(lines[i + 1]!)
  if (!first || (first[2]!.trim() === '' && !continuation)) return { titlePage: [], rest: lines }

  while (i < lines.length) {
    const line = lines[i]!
    if (line.trim() === '') break
    const m = line.match(keyRe)
    if (m && !/^\s/.test(line)) {
      current = { key: m[1]!.trim(), values: [] }
      titlePage.push(current)
      if (m[2]!.trim() !== '') current.values.push(m[2]!.trim())
    } else if (current) {
      current.values.push(line.trim())
    } else {
      break
    }
    i++
  }
  return { titlePage, rest: lines.slice(i) }
}
