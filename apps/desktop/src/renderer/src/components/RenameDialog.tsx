import { useState } from 'react'

interface Props {
  currentName: string
  error: string | null
  onRename(newName: string): void
  onClose(): void
}

/** File > Rename: renames the script plus its sidecar and stash together. */
export function RenameDialog({ currentName, error, onRename, onClose }: Props): React.JSX.Element {
  const base = currentName.replace(/\.(fountain|txt)$/i, '')
  const [name, setName] = useState(base)
  const changed = name.trim().length > 0 && name.trim() !== base

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Rename Script</h2>
        <p className="hint">
          The planning sidecar and stash files are renamed with it, so your cards, colors and cut
          material stay attached.
        </p>
        <label>
          New name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && changed) onRename(name.trim())
              if (e.key === 'Escape') onClose()
            }}
          />
        </label>
        {error && (
          <p className="hint dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!changed} onClick={() => onRename(name.trim())}>
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}
