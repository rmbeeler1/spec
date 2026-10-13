import type { Editor } from '@tiptap/core'

const SPEECH_CHILD = new Set(['dialogue', 'parenthetical', 'lyric'])

/**
 * Toggle dual dialogue on the speech the caret is in: its cue takes (or
 * drops) Fountain's ^, pairing it with the speech right before it. Returns
 * false when the caret is not in a speech or there is no preceding speech
 * to pair with.
 */
export function toggleDualOnCurrentSpeech(editor: Editor): boolean {
  const { $from } = editor.state.selection
  if ($from.depth < 1) return false
  let index = $from.index(0)
  const typeAt = (i: number): string =>
    editor.state.doc.child(i).attrs['type'] as string

  // Walk up to this speech's cue
  while (index >= 0 && SPEECH_CHILD.has(typeAt(index))) index--
  if (index < 0 || typeAt(index) !== 'character') return false

  const isDual = editor.state.doc.child(index).attrs['dual'] === true
  if (!isDual) {
    // Pairing needs a speech directly before this cue
    let b = index - 1
    while (b >= 0 && SPEECH_CHILD.has(typeAt(b))) b--
    if (b < 0 || typeAt(b) !== 'character' || b === index - 1) return false
  }

  let pos = 0
  for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize
  return editor
    .chain()
    .command(({ tr, state }) => {
      const node = state.doc.nodeAt(pos)!
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, dual: !isDual })
      return true
    })
    .run()
}
