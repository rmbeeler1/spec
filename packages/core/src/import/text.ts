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

export { importMarkdown } from './markdown'
