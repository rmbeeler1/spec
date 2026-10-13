import type { Editor } from '@tiptap/core'
import { nextSceneNumber, sequentialSceneNumbers } from '@spec/core'

/**
 * Scene numbering operations on the live document. Numbers are node
 * attributes that serialize to Fountain #1# markers, so they live in the
 * script file itself.
 */

interface HeadingAt {
  pos: number
  sceneNumber: string | null
}

function headings(editor: Editor): HeadingAt[] {
  const out: HeadingAt[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'element' && node.attrs['type'] === 'scene_heading') {
      out.push({ pos, sceneNumber: (node.attrs['sceneNumber'] as string | null) ?? null })
    }
    return false
  })
  return out
}

/** Number (or renumber) every scene 1..N. One undoable transaction. */
export function renumberScenes(editor: Editor): boolean {
  const list = headings(editor)
  if (list.length === 0) return false
  const numbers = sequentialSceneNumbers(list.length)
  return editor
    .chain()
    .command(({ tr, state }) => {
      list.forEach((h, i) => {
        const node = state.doc.nodeAt(h.pos)!
        tr.setNodeMarkup(h.pos, undefined, { ...node.attrs, sceneNumber: numbers[i] })
      })
      return true
    })
    .run()
}

/**
 * With numbering locked, scenes that appeared without a number (typed or
 * restored) get an A-number from their locked neighbors. Runs outside the
 * undo history: the number rides the node, so undoing the insertion removes
 * it anyway.
 */
export function autoNumberNewScenes(editor: Editor): void {
  const list = headings(editor)
  if (!list.some((h) => h.sceneNumber !== null)) return // nothing locked against
  const tr = editor.state.tr
  let changed = false
  for (let i = 0; i < list.length; i++) {
    if (list[i]!.sceneNumber !== null) continue
    const prev = [...list.slice(0, i)].reverse().find((h) => h.sceneNumber !== null)
    const next = list.slice(i + 1).find((h) => h.sceneNumber !== null)
    const num = nextSceneNumber(prev?.sceneNumber ?? null, next?.sceneNumber ?? null)
    const node = editor.state.doc.nodeAt(list[i]!.pos)!
    tr.setNodeMarkup(list[i]!.pos, undefined, { ...node.attrs, sceneNumber: num })
    list[i] = { ...list[i]!, sceneNumber: num }
    changed = true
  }
  if (!changed) return
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
}
