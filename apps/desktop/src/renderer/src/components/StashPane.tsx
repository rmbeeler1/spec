import type { StashChunk } from '@spec/core'
import { stashChunkSummary } from '@spec/core'

export interface StashItemView {
  chunk: StashChunk
  fromScene: string | null
  cutAt: string
}

interface Props {
  items: StashItemView[]
  canStash: boolean
  onStashSelection(): void
  onRestore(chunkId: string): void
  onClose(): void
}

/**
 * Cut material lives here (and in MyScript.stash.fountain on disk) instead
 * of the trash. Restore puts a chunk back at the caret.
 */
export function StashPane({
  items,
  canStash,
  onStashSelection,
  onRestore,
  onClose
}: Props): React.JSX.Element {
  return (
    <aside className="stash-pane">
      <div className="stash-header">
        <h2>Stash</h2>
        <button className="close" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <button
        className="stash-cut"
        disabled={!canStash}
        title={
          canStash
            ? 'Cut the selected lines out of the script and keep them here (Cmd/Ctrl+Shift+X)'
            : 'Put the cursor on the lines to stash, in the Write view'
        }
        onClick={onStashSelection}
      >
        Stash selection
      </button>
      {items.length === 0 && (
        <p className="empty">
          Nothing stashed. Select lines in the script and stash them instead of deleting; they stay
          in a plain-text file next to your script.
        </p>
      )}
      <ol className="stash-list">
        {items.map(({ chunk, fromScene, cutAt }) => (
          <li key={chunk.id} className="stash-item">
            <div className="stash-summary">{stashChunkSummary(chunk)}</div>
            <div className="stash-detail">
              {chunk.elements.length} element{chunk.elements.length === 1 ? '' : 's'}
              {fromScene ? ` · from ${fromScene}` : ''}
              {cutAt ? ` · ${new Date(cutAt).toLocaleString()}` : ''}
            </div>
            <div className="stash-preview">
              {chunk.elements
                .slice(0, 3)
                .map((e) => e.text.split('\n')[0])
                .join(' / ')}
            </div>
            <button
              className="stash-restore"
              title="Insert back into the script at the cursor"
              onClick={() => onRestore(chunk.id)}
            >
              Restore at cursor
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
