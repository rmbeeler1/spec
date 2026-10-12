import { Node } from '@tiptap/core'
import type { ElementType } from '@spec/core'

/**
 * The whole screenplay is a flat list of `element` blocks. Each block carries
 * its screenplay element type as an attribute, which keeps Tab/Enter type
 * switching a simple attribute change and maps 1:1 to the core document
 * model. Inline Fountain markup (*italics*, [[notes]]) stays as plain text,
 * so what you see is exactly what the .fountain file contains.
 */

/** Element types a writer can create and cycle through in the editor. */
export const CYCLE_TYPES: ElementType[] = [
  'scene_heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition'
]

export const ScreenplayDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'element+'
})

export const ScreenplayText = Node.create({
  name: 'text',
  group: 'inline'
})

/** Shift+Enter line break inside one element (multi-line action/dialogue). */
export const LineBreak = Node.create({
  name: 'lineBreak',
  inline: true,
  group: 'inline',
  selectable: false,
  parseHTML() {
    return [{ tag: 'br' }]
  },
  renderHTML() {
    return ['br']
  },
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () =>
        this.editor.commands.insertContent({ type: this.name })
    }
  }
})

export interface ElementAttrs {
  type: ElementType
  elementId: string | null
  sceneNumber: string | null
  dual: boolean
  depth: number | null
}

export const ScreenplayElement = Node.create({
  name: 'element',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      type: {
        default: 'action' satisfies ElementType,
        parseHTML: (el) => el.getAttribute('data-type') ?? 'action',
        renderHTML: (attrs) => ({ 'data-type': attrs['type'] as string })
      },
      elementId: { default: null, rendered: false },
      sceneNumber: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-scene-number'),
        renderHTML: (attrs) =>
          attrs['sceneNumber'] ? { 'data-scene-number': attrs['sceneNumber'] as string } : {}
      },
      dual: { default: false, rendered: false },
      depth: { default: null, rendered: false }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const type = node.attrs['type'] as string
    return ['div', { ...HTMLAttributes, class: `el el-${type}` }, 0]
  }
})
