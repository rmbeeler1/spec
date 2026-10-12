import type { Script } from '../model/types'
import type { IdGenerator } from '../model/ids'
import { normalizeLineEndings } from '../text'
import { classifyLines, type ClassifiedLine, type ImportLine } from './classifier'
import { buildScript, extractTitlePage } from './build'

export interface ImportResult {
  script: Script
  /** Per-line classification, for the review pane. */
  lines: ClassifiedLine[]
}

export interface ImportTextOptions {
  idGenerator?: IdGenerator
}

/** Import plain text (.txt) through the classifier. */
export function importPlainText(text: string, options: ImportTextOptions = {}): ImportResult {
  const raw = normalizeLineEndings(text).split('\n')
  const { titlePage, rest } = extractTitlePage(raw)
  const lines: ImportLine[] = rest.map((l) => ({ text: l }))
  const classified = classifyLines(lines)
  return { script: buildScript(classified, titlePage, options.idGenerator), lines: classified }
}

/**
 * Import Markdown (.md): headings become sections, emphasis markers are
 * already Fountain-compatible, the rest goes through the classifier.
 */
export function importMarkdown(text: string, options: ImportTextOptions = {}): ImportResult {
  const raw = normalizeLineEndings(text).split('\n')
  const { titlePage, rest } = extractTitlePage(raw)

  const lines: ImportLine[] = []
  const sectionAt = new Map<number, number>() // line index -> heading depth
  for (const line of rest) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      sectionAt.set(lines.length, heading[1]!.length)
      lines.push({ text: heading[2]! })
    } else {
      lines.push({ text: line })
    }
  }

  const classified = classifyLines(lines)
  for (const [index, depth] of sectionAt) {
    const line = classified[index]
    if (line && line.type !== 'blank') {
      line.type = 'section'
      line.confidence = 0.95
      void depth // depth is reapplied below when building
    }
  }
  const script = buildScript(classified, titlePage, options.idGenerator)
  // Restore section depths (buildScript does not know about them)
  let cursor = 0
  for (const [index, depth] of sectionAt) {
    const text = classified[index]?.text
    for (; cursor < script.elements.length; cursor++) {
      const el = script.elements[cursor]!
      if (el.type === 'section' && el.text === text) {
        el.depth = depth
        cursor++
        break
      }
    }
  }
  return { script, lines: classified }
}
