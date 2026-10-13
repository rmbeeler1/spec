import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'

/**
 * Page-break dividers. The App computes elementId -> page number with the
 * core paginator (debounced) and pushes it in via a transaction meta; this
 * plugin turns that into widget decorations above the matching elements.
 */
export const pageBreaksKey = new PluginKey<DecorationSet>('pageBreaks')

export interface PageBreaksMeta {
  breaks: Map<string, number>
}

function buildPageBreakDecorations(doc: PmNode, breaks: Map<string, number>): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'element') return false
    const id = node.attrs['elementId'] as string | null
    const page = id ? breaks.get(id) : undefined
    if (page !== undefined) {
      decorations.push(
        Decoration.widget(
          pos,
          () => {
            const div = document.createElement('div')
            div.className = 'page-divider'
            div.setAttribute('contenteditable', 'false')
            div.textContent = `PAGE ${page}`
            return div
          },
          { side: -1, key: `page-${page}` }
        )
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const PageBreaks = Extension.create({
  name: 'pageBreaks',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: pageBreaksKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(pageBreaksKey) as PageBreaksMeta | undefined
            if (meta) return buildPageBreakDecorations(tr.doc, meta.breaks)
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old
          }
        },
        props: {
          decorations(state) {
            return pageBreaksKey.getState(state)
          }
        }
      })
    ]
  }
})

/**
 * Character filter: dims every scene a chosen character does not appear in.
 * The App computes the scene IDs to KEEP and pushes them in via meta; null
 * clears the filter.
 */
export const sceneDimKey = new PluginKey<DecorationSet>('sceneDim')

export interface SceneDimMeta {
  /** Scene heading element IDs to keep bright; null turns the filter off. */
  keepSceneIds: Set<string> | null
}

function buildDimDecorations(doc: PmNode, keep: Set<string>): DecorationSet {
  const decorations: Decoration[] = []
  let dimming = false
  doc.descendants((node, pos) => {
    if (node.type.name !== 'element') return false
    if (node.attrs['type'] === 'scene_heading') {
      const id = node.attrs['elementId'] as string | null
      dimming = !(id && keep.has(id))
    }
    if (dimming) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'el-dimmed' }))
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const SceneDim = Extension.create({
  name: 'sceneDim',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: sceneDimKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(sceneDimKey) as SceneDimMeta | undefined
            if (meta) {
              return meta.keepSceneIds
                ? buildDimDecorations(tr.doc, meta.keepSceneIds)
                : DecorationSet.empty
            }
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old
          }
        },
        props: {
          decorations(state) {
            return sceneDimKey.getState(state)
          }
        }
      })
    ]
  }
})

/**
 * Dual dialogue columns. The doc stays flat; CSS does the layout: the first
 * speech's elements get el-dual-left (floated), the ^-cued speech gets
 * el-dual-right (normal flow beside the float, so the tops align), and the
 * next element clears the float.
 */
const SPEECH_CHILD = new Set(['dialogue', 'parenthetical', 'lyric'])

function buildDualDecorations(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = []
  const children: Array<{ node: PmNode; pos: number }> = []
  doc.forEach((node, offset) => children.push({ node, pos: offset }))

  const typeOf = (i: number): string => children[i]!.node.attrs['type'] as string
  const mark = (i: number, cls: string): void => {
    const { node, pos } = children[i]!
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: cls }))
  }

  for (let i = 0; i < children.length; i++) {
    if (typeOf(i) !== 'character' || children[i]!.node.attrs['dual'] !== true) continue
    // Walk back over the left speech to its cue
    let cue = -1
    for (let b = i - 1; b >= 0; b--) {
      const t = typeOf(b)
      if (SPEECH_CHILD.has(t)) continue
      if (t === 'character') cue = b
      break
    }
    if (cue === -1) continue
    for (let l = cue; l < i; l++) mark(l, 'el-dual-left')
    let r = i
    mark(r, 'el-dual-right')
    while (r + 1 < children.length && SPEECH_CHILD.has(typeOf(r + 1))) mark(++r, 'el-dual-right')
    if (r + 1 < children.length) mark(r + 1, 'el-dual-end')
    i = r
  }
  return DecorationSet.create(doc, decorations)
}

export const DualColumns = Extension.create({
  name: 'dualColumns',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        state: {
          init: (_config, state) => buildDualDecorations(state.doc),
          apply: (tr, old) => (tr.docChanged ? buildDualDecorations(tr.doc) : old)
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

/**
 * Marks the element containing the caret with a class, so focus mode can dim
 * everything else with plain CSS.
 */
export const CurrentElement = Extension.create({
  name: 'currentElement',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const $from = state.selection.$from
            if ($from.depth < 1) return DecorationSet.empty
            const node = $from.node(1)
            if (node.type.name !== 'element') return DecorationSet.empty
            const pos = $from.before(1)
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, { class: 'el-current' })
            ])
          }
        }
      })
    ]
  }
})
