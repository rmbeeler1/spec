import type { Editor } from '@tiptap/core'

const SPEECH_CHILD = new Set(['dialogue', 'parenthetical', 'lyric'])

export interface DualDecision {
  /** Top-level index of the cue whose dual flag should flip. */
  targetIndex: number
  makeDual: boolean
}

export interface DualRefusal {
  reason: string
}

/**
 * Decide what Toggle Dual Dialogue should do for a caret position, as a pure
 * function so it can be unit tested. Forgiving on purpose: the caret may sit
 * in either speech of the pair.
 *
 * - Caret in a speech whose cue is already dual: unmark it.
 * - Caret in a speech directly after another speech: mark this speech's cue.
 * - Caret in a speech directly before another speech: mark (or unmark) the
 *   following speech's cue.
 * - Anything else refuses with a reason the app can show.
 */
export function dualToggleDecision(
  elements: Array<{ type: string; dual: boolean }>,
  caretIndex: number
): DualDecision | DualRefusal {
  if (caretIndex < 0 || caretIndex >= elements.length) {
    return { reason: 'Click into a speech first.' }
  }

  // Walk up to this speech's cue
  let cue = caretIndex
  while (cue >= 0 && SPEECH_CHILD.has(elements[cue]!.type)) cue--
  if (cue < 0 || elements[cue]!.type !== 'character') {
    return {
      reason:
        'Dual dialogue pairs two speeches. Click into one of the two speeches, then toggle again.'
    }
  }

  if (elements[cue]!.dual) return { targetIndex: cue, makeDual: false }

  // A speech directly before this one? Then this cue takes the ^.
  let before = cue - 1
  while (before >= 0 && SPEECH_CHILD.has(elements[before]!.type)) before--
  const hasSpeechBefore = before >= 0 && elements[before]!.type === 'character' && before < cue - 1
  if (hasSpeechBefore) return { targetIndex: cue, makeDual: true }

  // Otherwise, a speech directly after this one? Then that cue takes the ^.
  let after = cue + 1
  while (after < elements.length && SPEECH_CHILD.has(elements[after]!.type)) after++
  if (after < elements.length && elements[after]!.type === 'character' && after > cue + 1) {
    return { targetIndex: after, makeDual: !elements[after]!.dual }
  }

  return {
    reason:
      'Dual dialogue needs two speeches back to back, with nothing between them. Move the speeches together, then toggle again.'
  }
}

export interface DualToggleResult {
  ok: boolean
  reason?: string
}

/** Apply the decision to the live document. */
export function toggleDualOnCurrentSpeech(editor: Editor): DualToggleResult {
  const { $from } = editor.state.selection
  if ($from.depth < 1) return { ok: false, reason: 'Click into a speech first.' }

  const elements: Array<{ type: string; dual: boolean }> = []
  editor.state.doc.forEach((node) => {
    elements.push({
      type: node.attrs['type'] as string,
      dual: node.attrs['dual'] === true
    })
  })

  const decision = dualToggleDecision(elements, $from.index(0))
  if ('reason' in decision) return { ok: false, reason: decision.reason }

  let pos = 0
  for (let i = 0; i < decision.targetIndex; i++) pos += editor.state.doc.child(i).nodeSize
  const ok = editor
    .chain()
    .command(({ tr, state }) => {
      const node = state.doc.nodeAt(pos)!
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, dual: decision.makeDual })
      return true
    })
    .run()
  return ok ? { ok: true } : { ok: false, reason: 'Could not change the speech.' }
}
