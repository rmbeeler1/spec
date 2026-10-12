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
