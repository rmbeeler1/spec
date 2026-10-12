import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export interface Match {
  from: number
  to: number
}

/**
 * Plain-text search within text nodes (matches cannot span line breaks or
 * element boundaries). Case-insensitive.
 */
export function findMatches(editor: Editor, query: string): Match[] {
  if (query.length === 0) return []
  const needle = query.toLowerCase()
  const out: Match[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true
    const hay = node.text.toLowerCase()
    let idx = hay.indexOf(needle)
    while (idx !== -1) {
      out.push({ from: pos + idx, to: pos + idx + needle.length })
      idx = hay.indexOf(needle, idx + 1)
    }
    return true
  })
  return out
}

/** Select the next match after the current selection, wrapping around. */
export function selectNextMatch(editor: Editor, matches: Match[]): Match | null {
  if (matches.length === 0) return null
  const after = editor.state.selection.to
  const next = matches.find((m) => m.from >= after) ?? matches[0]!
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setSelection(TextSelection.create(tr.doc, next.from, next.to))
      tr.scrollIntoView()
      return true
    })
    .run()
  return next
}

export function replaceSelection(editor: Editor, replacement: string): void {
  editor.chain().focus().insertContent(replacement).run()
}

export function replaceAll(editor: Editor, query: string, replacement: string): number {
  const matches = findMatches(editor, query)
  if (matches.length === 0) return 0
  editor
    .chain()
    .command(({ tr }) => {
      for (const m of [...matches].reverse()) {
        tr.insertText(replacement, m.from, m.to)
      }
      return true
    })
    .run()
  return matches.length
}
