import type { TitlePageEntry } from '../model/types'
import type { IdGenerator } from '../model/ids'
import { normalizeLineEndings } from '../text'
import { classifyLines, type ImportLine } from './classifier'
import { buildScript, extractTitlePage } from './build'
import type { ImportResult } from './text'

/**
 * Markdown screenplay import. Real-world Markdown scripts bold their scene
 * headings and cues, italicize parentheticals, separate blocks with --- and
 * use # headings for acts and scenes. All of that syntax must come off
 * before classification; boldness survives as a confidence hint.
 */

interface MdLine {
  text: string
  bold?: boolean
  /** Markdown heading depth (# = 1) when the line was a heading. */
  section?: number
}

/** Remove inline emphasis markers, keeping the text. */
export function stripInlineMarkdown(line: string): string {
  return line
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, '$1$2')
}

function toMdLines(text: string): MdLine[] {
  return normalizeLineEndings(text)
    .split('\n')
    .map((raw) => {
      const t = raw.trim()
      // Horizontal rules are visual separators: treat as blank lines
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return { text: '' }
      const heading = t.match(/^(#{1,6})\s+(.*)$/)
      if (heading) {
        return { text: stripInlineMarkdown(heading[2]!).trim(), section: heading[1]!.length }
      }
      const bold = /^(\*\*|__).+(\*\*|__)$/.test(t)
      const line: MdLine = { text: stripInlineMarkdown(raw).trimEnd() }
      if (bold) line.bold = true
      return line
    })
}

/**
 * Markdown scripts rarely use Fountain's "Key: value" title page. When the
 * document opens with a # title, read the front matter the way humans write
 * it: the H1 is the title, "Written by" is the credit (the next line its
 * author), "Based on…" is the source, and any other leading text joins the
 * title block. Front matter ends at the first structural line (FADE IN, a
 * scene heading, or an act/scene heading).
 */
const ACT_LIKE = /^(ACT|SCENE|PART|EPISODE|CHAPTER|TEASER|TAG|COLD OPEN|PROLOGUE|EPILOGUE)\b/i

function extractMdFrontMatter(lines: MdLine[]): { titlePage: TitlePageEntry[]; bodyStart: number } {
  let i = 0
  while (i < lines.length && lines[i]!.text.trim() === '') i++
  // A leading # heading is the script's title, unless it reads like an act
  // marker ("# Act One"), in which case it is structure, not a title page.
  if (lines[i]?.section !== 1 || ACT_LIKE.test(lines[i]!.text)) {
    // No leading # title: fall back to the Key: value form
    const { titlePage, rest } = extractTitlePage(lines.map((l) => l.text))
    return { titlePage, bodyStart: lines.length - rest.length }
  }

  // Front matter ends at the script proper: FADE IN, a scene heading, or an
  // act/scene-style section. A heading like "### An Original Screenplay" is
  // part of the title block, not structure.
  const isStructural = (l: MdLine): boolean =>
    /^(FADE IN)[.:]?$/i.test(l.text.trim()) ||
    /^(INT\.?\/EXT|INT|EXT|EST|I\/E)[.\s]/i.test(l.text.trim()) ||
    (l.section !== undefined && l.section >= 2 && ACT_LIKE.test(l.text))

  const title: TitlePageEntry = { key: 'Title', values: [lines[i]!.text] }
  const titlePage: TitlePageEntry[] = [title]
  i++

  const limit = Math.min(lines.length, i + 40)
  while (i < limit && !isStructural(lines[i]!)) {
    const t = lines[i]!.text.trim()
    if (t === '') {
      i++
      continue
    }
    if (/^written by$/i.test(t)) {
      titlePage.push({ key: 'Credit', values: ['Written by'] })
      // The author usually sits on the next non-blank line
      let j = i + 1
      while (j < limit && lines[j]!.text.trim() === '') j++
      const next = lines[j]?.text.trim() ?? ''
      if (next !== '' && !/^based on/i.test(next) && !isStructural(lines[j]!)) {
        titlePage.push({ key: 'Author', values: [next] })
        i = j + 1
        continue
      }
    } else if (/^based on/i.test(t)) {
      titlePage.push({ key: 'Source', values: [t] })
    } else {
      title.values.push(t) // subtitle lines stay with the title block
    }
    i++
  }
  return { titlePage, bodyStart: i }
}

export function importMarkdown(
  text: string,
  options: { idGenerator?: IdGenerator } = {}
): ImportResult {
  const mdLines = toMdLines(text)
  const { titlePage, bodyStart } = extractMdFrontMatter(mdLines)
  const body = mdLines.slice(bodyStart)

  const importLines: ImportLine[] = body.map((l) => {
    const line: ImportLine = { text: l.text }
    if (l.bold) line.bold = true
    return line
  })
  const classified = classifyLines(importLines)

  // Markdown headings are authoritative: they are sections, whatever the
  // classifier guessed from the bare text.
  for (let i = 0; i < body.length; i++) {
    const depth = body[i]!.section
    const line = classified[i]
    if (depth !== undefined && line && line.type !== 'blank') {
      line.type = 'section'
      line.confidence = 0.98
      line.depth = depth
    }
  }

  return { script: buildScript(classified, titlePage, options.idGenerator), lines: classified }
}
