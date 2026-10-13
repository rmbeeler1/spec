/**
 * Pairs editor undo/redo with stash bookkeeping. A stash cut (or restore) is
 * one closed step in the ProseMirror history plus one stash entry change.
 * Undoing the step must also reverse the entry change, or the text would come
 * back while a duplicate sits in the stash.
 *
 * The trick: when the op happens we record the editor's undo depth. When the
 * user hits undo and the current depth equals a recorded one, the step about
 * to be undone IS that op, so the app reverses the stash side too. Pure
 * bookkeeping here; the caller supplies depths from prosemirror-history.
 */

export type PairedKind = 'stash' | 'restore'

export interface PairedAction {
  kind: PairedKind
  entryId: string
  /** undoDepth right after the op was applied. */
  depth: number
}

export class UndoPairing {
  private undoStack: PairedAction[] = []
  private redoStack: PairedAction[] = []

  /** Call right after a stash or restore op, with the new undoDepth. */
  record(kind: PairedKind, entryId: string, depthAfter: number): void {
    this.undoStack.push({ kind, entryId, depth: depthAfter })
    this.redoStack = [] // same rule as the editor: new work clears redo
  }

  /**
   * Call when the user asks to undo, BEFORE performing it. Returns the
   * paired action if the step about to be undone is one of ours.
   */
  matchUndo(currentUndoDepth: number): PairedAction | null {
    const top = this.undoStack[this.undoStack.length - 1]
    if (!top || top.depth !== currentUndoDepth) return null
    this.undoStack.pop()
    this.redoStack.push(top)
    return top
  }

  /** Same for redo: the step about to be redone, by matching undo depth. */
  matchRedo(currentUndoDepth: number): PairedAction | null {
    const top = this.redoStack[this.redoStack.length - 1]
    if (!top || top.depth !== currentUndoDepth + 1) return null
    this.redoStack.pop()
    this.undoStack.push(top)
    return top
  }

  /** Dropped on file load: history and stash both start fresh. */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
