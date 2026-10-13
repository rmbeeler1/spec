import type { Editor } from '@tiptap/core'
import { renameCue, renameInProse } from '@spec/core'

const PROSE_TYPES = new Set([
  'action',
  'dialogue',
  'parenthetical',
  'synopsis',
  'centered',
  'lyric'
])

/**
 * Rename a character across the whole document in one undoable transaction:
 * cues keep their extensions, prose mentions are replaced whole-word with
 * their casing preserved. Replacement happens per text chunk so the line
 * breaks inside multi-line elements survive. Returns how many elements
 * changed.
 */
export function renameCharacterEverywhere(
  editor: Editor,
  oldBase: string,
  newName: string
): number {
  const edits: Array<{ from: number; to: number; text: string }> = []
  const changedElements = new Set<number>()

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'element') return false
    const type = node.attrs['type'] as string
    const isCue = type === 'character'
    if (!isCue && !PROSE_TYPES.has(type)) return false

    // Cues are single-line; renaming needs the whole cue text to keep
    // extensions, and the result lands in its (single) text child.
    if (isCue) {
      const next = renameCue(node.textContent, oldBase, newName)
      if (next !== node.textContent) {
        edits.push({ from: pos + 1, to: pos + 1 + node.content.size, text: next })
        changedElements.add(pos)
      }
      return false
    }

    // Prose: rename each text chunk in place, leaving lineBreaks untouched
    node.forEach((child, offset) => {
      if (!child.isText || !child.text) return
      const next = renameInProse(child.text, oldBase, newName)
      if (next !== child.text) {
        const from = pos + 1 + offset
        edits.push({ from, to: from + child.text.length, text: next })
        changedElements.add(pos)
      }
    })
    return false
  })
  if (edits.length === 0) return 0

  editor
    .chain()
    .command(({ tr }) => {
      // Apply back to front so earlier positions stay valid
      for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
        tr.insertText(edit.text, edit.from, edit.to)
      }
      return true
    })
    .run()
  return changedElements.size
}
