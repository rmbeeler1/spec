import type { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { parseFountain, type ScriptElement } from '@spec/core'
import { docToScript, scriptToDoc, type PmDoc, type PmElement } from './convert'
import { sceneRangeAtSelection } from './scenes'

/**
 * Omitting a scene, production style: the heading stays in the script as
 * "OMITTED" (keeping its scene number), everything else moves to the stash,
 * so nothing is ever deleted. Un-omitting swaps the placeholder back for the
 * stored scene. Each is one closed undo step for pairing.
 */

export interface OmitResult {
  /** The whole scene (original heading included), for the stash chunk. */
  elements: ScriptElement[]
  originalHeading: string
  sceneNumber: string | null
}

export function omitCurrentScene(editor: Editor): OmitResult | null {
  const range = sceneRangeAtSelection(editor)
  if (!range) return null
  const headingNode = editor.state.doc.nodeAt(range.headingPos)!
  const originalHeading = headingNode.textContent
  if (originalHeading.trim().toUpperCase() === 'OMITTED') return null // already omitted
  const sceneNumber = (headingNode.attrs['sceneNumber'] as string | null) ?? null

  const slice = editor.state.doc.slice(range.from, range.to)
  const pmElements: PmElement[] = []
  slice.content.forEach((node) => {
    if (node.type.name === 'element') pmElements.push(node.toJSON() as PmElement)
  })
  const script = docToScript({ type: 'doc', content: pmElements }, [])
  if (script.elements.length === 0) return null

  const ok = editor
    .chain()
    .command(({ tr, state }) => {
      const placeholder = state.schema.nodes['element']!.create(
        {
          type: 'scene_heading',
          elementId: null,
          sceneNumber,
          dual: false,
          depth: null
        },
        state.schema.text('OMITTED')
      )
      tr.replaceWith(range.from, range.to, placeholder)
      closeHistory(tr)
      return true
    })
    .run()
  if (!ok) return null
  return { elements: script.elements, originalHeading, sceneNumber }
}

/**
 * Replace the OMITTED placeholder the caret is on with the stored scene.
 * The caller supplies the chunk's Fountain text.
 */
export function unOmitAtSelection(editor: Editor, fountain: string): boolean {
  const range = sceneRangeAtSelection(editor)
  if (!range) return false
  const headingNode = editor.state.doc.nodeAt(range.headingPos)!
  if (headingNode.textContent.trim().toUpperCase() !== 'OMITTED') return false

  const script = parseFountain(fountain)
  if (script.elements.length === 0) return false
  const doc: PmDoc = scriptToDoc(script)

  return editor
    .chain()
    .command(({ tr, state }) => {
      const nodes = doc.content.map((n) => state.schema.nodeFromJSON(n))
      // Only the placeholder heading is replaced; anything typed under the
      // OMITTED line since stays in the script after the restored scene
      const headingEnd = range.headingPos + headingNode.nodeSize
      let pos = range.headingPos
      tr.delete(range.headingPos, headingEnd)
      for (const node of nodes) {
        tr.insert(pos, node)
        pos += node.nodeSize
      }
      closeHistory(tr)
      return true
    })
    .run()
}
