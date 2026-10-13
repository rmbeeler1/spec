import type { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { TextSelection } from '@tiptap/pm/state'
import { parseFountain, type ScriptElement } from '@spec/core'
import { docToScript, scriptToDoc, type PmDoc, type PmElement } from './convert'

/**
 * Moving material between the script and the stash. Each move is one closed
 * undo step in the editor history, so the app can pair Cmd+Z with the
 * matching stash entry (see undoPairing.ts).
 */

export interface CutResult {
  elements: ScriptElement[]
  /** Heading of the scene the cut started in, for the stash entry label. */
  fromScene: string | null
}

/**
 * Cut the elements the selection touches (whole blocks, never partial text)
 * out of the document. Returns null when there is nothing to cut.
 */
export function cutSelectionToStash(editor: Editor): CutResult | null {
  const { state } = editor
  const { $from, $to } = state.selection
  if ($from.depth < 1) return null

  const from = $from.before(1)
  const to = $to.after(1)
  const slice = state.doc.slice(from, to)

  const pmElements: PmElement[] = []
  slice.content.forEach((node) => {
    if (node.type.name === 'element') pmElements.push(node.toJSON() as PmElement)
  })
  const script = docToScript({ type: 'doc', content: pmElements }, [])
  if (script.elements.length === 0) return null

  // The scene the cut starts in: the nearest heading at or before `from`
  let fromScene: string | null = null
  state.doc.nodesBetween(0, from, (node) => {
    if (node.type.name === 'element' && node.attrs['type'] === 'scene_heading') {
      fromScene = node.textContent
    }
    return false
  })

  const emptied = from === 0 && to >= state.doc.content.size
  const ok = editor
    .chain()
    .command(({ tr }) => {
      tr.delete(from, to)
      // A document cannot be empty; cutting everything leaves one action line
      if (emptied) return true
      closeHistory(tr)
      return true
    })
    .run()
  if (!ok) return null
  return { elements: script.elements, fromScene }
}

/**
 * Insert a stashed chunk back into the script after the element the caret is
 * in (or at the end when the caret is nowhere useful). One closed undo step.
 */
export function insertFountainAfterCaret(editor: Editor, fountain: string): boolean {
  const script = parseFountain(fountain)
  if (script.elements.length === 0) return false
  const doc: PmDoc = scriptToDoc(script)
  const nodes = doc.content

  const { $from } = editor.state.selection
  const insertAt = $from.depth >= 1 ? $from.after(1) : editor.state.doc.content.size

  return editor
    .chain()
    .command(({ tr, state }) => {
      const pmNodes = nodes.map((n) => state.schema.nodeFromJSON(n))
      let pos = insertAt
      for (const node of pmNodes) {
        tr.insert(pos, node)
        pos += node.nodeSize
      }
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)))
      closeHistory(tr)
      return true
    })
    .run()
}
