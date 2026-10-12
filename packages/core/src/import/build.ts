import type { Script, ScriptElement, TitlePageEntry } from '../model/types'
import { randomIdGenerator, type IdGenerator } from '../model/ids'
import type { ClassifiedLine } from './classifier'

/**
 * Assemble classified lines into a Script: consecutive action lines in one
 * blank-delimited block merge into one element, dialogue lines under a cue
 * merge into one dialogue element, blanks separate everything else.
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
      elements.push({ id: nextId(), type, text: parts.join('\n') })
      i = j
      continue
    }
    elements.push({ id: nextId(), type: line.type, text: line.text })
    i++
  }

  return { titlePage, elements }
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

  // Only treat it as a title page when the very first content line is a
  // key with a value (same guard as the Fountain parser: a lone "CUT TO:"
  // is a transition, not a key).
  while (i < lines.length && lines[i]!.trim() === '') i++
  const first = lines[i]?.match(keyRe)
  if (!first || first[2]!.trim() === '') return { titlePage: [], rest: lines }

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
