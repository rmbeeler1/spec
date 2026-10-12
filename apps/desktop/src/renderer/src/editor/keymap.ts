import { Extension } from '@tiptap/core'
import type { ElementType } from '@spec/core'
import { cycleType, detectTypeOnEnter, nextTypeOnEnter, typeForShortcut } from './keymapLogic'

/**
 * Enter: finish the current element (running auto detection on it) and start
 * the next one with the natural follow-on type. Enter on an empty element
 * turns it into action instead of stacking empty blocks.
 * Tab / Shift-Tab: cycle the current element's type.
 * CmdOrCtrl+1..6: set the type directly.
 */
export const ScreenplayKeymap = Extension.create({
  name: 'screenplayKeymap',

  addKeyboardShortcuts() {
    const setType = (type: ElementType) => (): boolean =>
      this.editor.commands.updateAttributes('element', { type })

    const shortcuts: Record<string, () => boolean> = {
      Enter: () => {
        const { state } = this.editor
        const node = state.selection.$from.parent
        if (node.type.name !== 'element') return false
        const current = node.attrs['type'] as ElementType

        if (node.textContent.trim().length === 0) {
          // Empty element: demote to action rather than adding another block
          if (current === 'action') return true // swallow: no empty block stacking
          return this.editor.commands.updateAttributes('element', { type: 'action' })
        }

        const detected = detectTypeOnEnter(node.textContent, current)
        const chain = this.editor.chain()
        if (detected !== current) chain.updateAttributes('element', { type: detected })
        return chain
          .splitBlock({ keepMarks: false })
          .updateAttributes('element', {
            type: nextTypeOnEnter(detected),
            elementId: null,
            sceneNumber: null,
            dual: false,
            depth: null
          })
          .run()
      },

      Tab: () => {
        const node = this.editor.state.selection.$from.parent
        if (node.type.name !== 'element') return false
        return this.editor.commands.updateAttributes('element', {
          type: cycleType(node.attrs['type'] as ElementType)
        })
      },

      'Shift-Tab': () => {
        const node = this.editor.state.selection.$from.parent
        if (node.type.name !== 'element') return false
        return this.editor.commands.updateAttributes('element', {
          type: cycleType(node.attrs['type'] as ElementType, true)
        })
      }
    }

    for (let d = 1; d <= 6; d++) {
      const type = typeForShortcut(d)
      if (type) shortcuts[`Mod-${d}`] = setType(type)
    }
    return shortcuts
  }
})
