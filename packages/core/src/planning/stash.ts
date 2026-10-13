import type { Script, ScriptElement } from '../model/types'
import { parseFountain } from '../fountain/parse'
import { serializeFountain } from '../fountain/serialize'
import type { IdGenerator } from '../model/ids'

/**
 * The stash file (MyScript.stash.fountain) is plain Fountain: cut material
 * stays human-readable text, never trapped in JSON. Each stashed chunk is
 * preceded by a marker note the app recognizes:
 *
 *   [[spec-stash <id> <ISO timestamp>]]
 *
 * Everything between one marker and the next belongs to that chunk. Text
 * before the first marker (someone edited the file by hand) is kept as a
 * chunk of its own rather than dropped.
 */

export interface StashChunk {
  id: string
  cutAt: string
  elements: ScriptElement[]
}

const MARKER = /^spec-stash\s+(\S+)(?:\s+(\S+))?$/

export function parseStashFile(
  text: string,
  options: { idGenerator?: IdGenerator } = {}
): StashChunk[] {
  const script = parseFountain(text, options)
  const chunks: StashChunk[] = []
  let current: StashChunk | null = null

  for (const el of script.elements) {
    const m = el.type === 'note' ? el.text.trim().match(MARKER) : null
    if (m) {
      current = { id: m[1]!, cutAt: m[2] ?? '', elements: [] }
      chunks.push(current)
      continue
    }
    if (!current) {
      if (el.text.trim().length === 0 && el.type !== 'page_break') continue
      current = { id: 'recovered', cutAt: '', elements: [] }
      chunks.push(current)
    }
    current.elements.push(el)
  }
  return chunks.filter((c) => c.elements.length > 0)
}

export function serializeStashFile(chunks: StashChunk[]): string {
  const parts: string[] = []
  for (const chunk of chunks) {
    const marker: ScriptElement = {
      id: `marker-${chunk.id}`,
      type: 'note',
      text: `spec-stash ${chunk.id}${chunk.cutAt ? ` ${chunk.cutAt}` : ''}`
    }
    const script: Script = { titlePage: [], elements: [marker, ...chunk.elements] }
    parts.push(serializeFountain(script).trimEnd())
  }
  return parts.length > 0 ? parts.join('\n\n') + '\n' : ''
}

/** Fountain text of one chunk, for restoring into the editor. */
export function stashChunkFountain(chunk: StashChunk): string {
  return serializeFountain({ titlePage: [], elements: chunk.elements })
}

/** One-line summary for the stash pane: the first non-empty line of text. */
export function stashChunkSummary(chunk: StashChunk): string {
  for (const el of chunk.elements) {
    const line = el.text.split('\n').find((l) => l.trim().length > 0)
    if (line) return line.trim()
  }
  return '(empty)'
}
