import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export interface SceneInfo {
  /** Position of the scene heading node in the document. */
  pos: number
  heading: string
  sceneNumber: string | null
}

interface SceneRange {
  from: number
  to: number
}

export function listScenes(editor: Editor): SceneInfo[] {
  const out: SceneInfo[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'element' && node.attrs['type'] === 'scene_heading') {
      out.push({
        pos,
        heading: node.textContent,
        sceneNumber: (node.attrs['sceneNumber'] as string | null) ?? null
      })
    }
    return false
  })
  return out
}

export function jumpToScene(editor: Editor, pos: number): void {
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
      tr.scrollIntoView()
      return true
    })
    .run()
}

/** A scene spans from its heading to the next heading (or document end). */
function sceneRanges(editor: Editor): SceneRange[] {
  const scenes = listScenes(editor)
  const docEnd = editor.state.doc.content.size
  return scenes.map((s, i) => ({
    from: s.pos,
    to: i + 1 < scenes.length ? scenes[i + 1]!.pos : docEnd
  }))
}

/** Swap a scene with its neighbor. Returns false when there is no neighbor. */
export function moveScene(editor: Editor, sceneIndex: number, direction: 'up' | 'down'): boolean {
  const ranges = sceneRanges(editor)
  const scene = ranges[sceneIndex]
  if (!scene) return false
  const neighbor = ranges[direction === 'up' ? sceneIndex - 1 : sceneIndex + 1]
  if (!neighbor) return false

  return editor
    .chain()
    .command(({ tr, state }) => {
      const slice = state.doc.slice(scene.from, scene.to)
      tr.delete(scene.from, scene.to)
      const target =
        direction === 'up' ? neighbor.from : neighbor.to - (scene.to - scene.from)
      tr.insert(target, slice.content)
      return true
    })
    .run()
}
