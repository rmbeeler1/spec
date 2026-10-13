import { useState } from 'react'

interface Props {
  oldName: string
  onRename(newName: string): void
  onClose(): void
}

/**
 * Rename a character everywhere: cues keep their (V.O.) and (CONT'D)
 * extensions, and mentions in action and dialogue follow along, matching
 * whole words only.
 */
export function RenameCharacterDialog({ oldName, onRename, onClose }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const valid = name.trim().length > 0 && name.trim().toUpperCase() !== oldName

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Rename {oldName}</h2>
        <p className="hint">
          Every cue keeps its (V.O.) or (CONT'D), and mentions of the name in action and dialogue
          change too, whole words only. One Cmd/Ctrl+Z undoes the entire rename.
        </p>
        <label>
          New name
          <input
            autoFocus
            value={name}
            placeholder={oldName}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) {
                onRename(name.trim())
                onClose()
              }
              if (e.key === 'Escape') onClose()
            }}
          />
        </label>
        <div className="dialog-buttons">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={!valid}
            onClick={() => {
              onRename(name.trim())
              onClose()
            }}
          >
            Rename Everywhere
          </button>
        </div>
      </div>
    </div>
  )
}
