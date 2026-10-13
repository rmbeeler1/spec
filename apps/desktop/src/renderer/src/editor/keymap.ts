import { Extension } from '@tiptap/core'
import type { ElementType } from '@spec/core'
import { toggleDualOnCurrentSpeech } from './dual'
import {
  cycleType,
  detectStructure,
  detectTypeOnEnter,
  needsContd,
  nextTypeOnEnter,
  normalizeSceneHeading,
  typeForShortcut,
  withContd
} from './keymapLogic'

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

        // "# Act One" or "= synopsis" typed by hand become structure elements
        const structure = detectStructure(node.textContent, current)
        if (structure) {
          const from = state.selection.$from.start()
          const to = state.selection.$from.end()
          return this.editor
            .chain()
            .command(({ tr }) => {
              tr.insertText(structure.text, from, to)
              return true
            })
            .updateAttributes('element', {
              type: structure.type,
              depth: structure.type === 'section' ? structure.depth : null
            })
            .splitBlock({ keepMarks: false })
            .updateAttributes('element', {
              type: 'action',
              elementId: null,
              sceneNumber: null,
              dual: false,
              depth: null
            })
            .run()
        }

        const detected = detectTypeOnEnter(node.textContent, current)

        // Text fixups on the element being finished: normalize scene heading
        // prefixes and add (CONT'D) when the same character speaks again.
        let replacement: string | null = null
        if (detected === 'scene_heading') {
          const normalized = normalizeSceneHeading(node.textContent)
          if (normalized !== node.textContent) replacement = normalized
        } else if (detected === 'character') {
          const $from = state.selection.$from
          const index = $from.index(0)
          const previous: Array<{ type: ElementType; text: string }> = []
          for (let i = 0; i < index; i++) {
            const child = state.doc.child(i)
            previous.push({ type: child.attrs['type'] as ElementType, text: child.textContent })
          }
          if (needsContd(previous, node.textContent)) {
            replacement = withContd(node.textContent)
          }
        }

        const contentFrom = state.selection.$from.start()
        const contentTo = state.selection.$from.end()
        const chain = this.editor.chain()
        if (replacement !== null) {
          const text = replacement
          chain.command(({ tr }) => {
            tr.insertText(text, contentFrom, contentTo)
            return true
          })
        }
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

    // Also bound in the native menu; this editor-level binding makes the
    // shortcut work even if something at the OS level eats the accelerator,
    // and lets a refusal explain itself instead of failing silently.
    shortcuts['Mod-Shift-b'] = () => {
      const result = toggleDualOnCurrentSpeech(this.editor)
      if (!result.ok && result.reason) {
        window.dispatchEvent(new CustomEvent('spec:toast', { detail: result.reason }))
      }
      return true
    }
    return shortcuts
  }
})
