import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { randomIdGenerator } from '@spec/core'

export interface SceneInfo {
  /** Position of the scene heading node in the document. */
  pos: number
  heading: string
  sceneNumber: string | null
  /** Stable element ID; planning data keys off this. */
  id: string | null
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
        sceneNumber: (node.attrs['sceneNumber'] as string | null) ?? null,
        id: (node.attrs['elementId'] as string | null) ?? null
      })
    }
    return false
  })
  return out
}

/**
 * Scene headings typed in this session start with no element ID. Planning
 * data needs one, so assign IDs lazily, outside the undo history (undoing a
 * keystroke should never strip an ID planning data already points at).
 */
export function assignMissingSceneIds(editor: Editor): void {
  const missing: number[] = []
  editor.state.doc.descendants((node, pos) => {
    if (
      node.type.name === 'element' &&
      node.attrs['type'] === 'scene_heading' &&
      !node.attrs['elementId']
    ) {
      missing.push(pos)
    }
    return false
  })
  if (missing.length === 0) return
  const nextId = randomIdGenerator()
  const tr = editor.state.tr
  for (const pos of missing) {
    const node = editor.state.doc.nodeAt(pos)!
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, elementId: nextId() })
  }
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
}

export interface StructureInfo {
  kind: 'section' | 'scene'
  pos: number
  text: string
  /** Sections only: 1 for #, 2 for ##. Scenes report 0. */
  depth: number
  id: string | null
}

/** Sections and scene headings in document order, for the outline view. */
export function listStructure(editor: Editor): StructureInfo[] {
  const out: StructureInfo[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'element') return false
    const type = node.attrs['type'] as string
    if (type === 'section') {
      out.push({
        kind: 'section',
        pos,
        text: node.textContent,
        depth: (node.attrs['depth'] as number | null) ?? 1,
        id: (node.attrs['elementId'] as string | null) ?? null
      })
    } else if (type === 'scene_heading') {
      out.push({
        kind: 'scene',
        pos,
        text: node.textContent,
        depth: 0,
        id: (node.attrs['elementId'] as string | null) ?? null
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

/**
 * Write a scene's synopsis back into the script: replace the text of the
 * scene's first `=` synopsis element, or insert a new one right after the
 * heading. Empty text removes the synopsis. One undoable transaction.
 */
export function setSceneSynopsis(editor: Editor, sceneId: string, text: string): boolean {
  let headingPos = -1
  let headingSize = 0
  let synopsisPos = -1
  let synopsisSize = 0
  let pastScene = false

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'element' || pastScene) return false
    const type = node.attrs['type'] as string
    if (headingPos === -1) {
      if (type === 'scene_heading' && node.attrs['elementId'] === sceneId) {
        headingPos = pos
        headingSize = node.nodeSize
      }
      return false
    }
    if (type === 'scene_heading') {
      pastScene = true
      return false
    }
    if (type === 'synopsis' && synopsisPos === -1) {
      synopsisPos = pos
      synopsisSize = node.nodeSize
    }
    return false
  })
  if (headingPos === -1) return false

  const trimmed = text.trim()
  return editor
    .chain()
    .command(({ tr, state }) => {
      if (synopsisPos !== -1) {
        if (trimmed.length === 0) {
          tr.delete(synopsisPos, synopsisPos + synopsisSize)
        } else {
          tr.replaceWith(
            synopsisPos + 1,
            synopsisPos + synopsisSize - 1,
            state.schema.text(trimmed)
          )
        }
      } else if (trimmed.length > 0) {
        const node = state.schema.nodes['element']!.create(
          { type: 'synopsis', elementId: null, sceneNumber: null, dual: false, depth: null },
          state.schema.text(trimmed)
        )
        tr.insert(headingPos + headingSize, node)
      }
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
  return moveSceneTo(editor, sceneIndex, direction === 'up' ? sceneIndex - 1 : sceneIndex + 1)
}

/** Move a scene so it ends up at the given index. One undoable transaction. */
export function moveSceneTo(editor: Editor, fromIndex: number, toIndex: number): boolean {
  const ranges = sceneRanges(editor)
  const scene = ranges[fromIndex]
  const target = ranges[toIndex]
  if (!scene || !target || fromIndex === toIndex) return false

  return editor
    .chain()
    .command(({ tr, state }) => {
      const slice = state.doc.slice(scene.from, scene.to)
      tr.delete(scene.from, scene.to)
      const size = scene.to - scene.from
      const insertAt = toIndex < fromIndex ? target.from : target.to - size
      tr.insert(insertAt, slice.content)
      return true
    })
    .run()
}
