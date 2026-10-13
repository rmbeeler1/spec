import { useState } from 'react'
import {
  nextRevisionColor,
  revisionColorValue,
  type RevisionSetDef
} from '@spec/core'

interface Props {
  sets: RevisionSetDef[]
  activeSetId: string | undefined
  onStart(name: string, color: string): void
  onEndActive(): void
  onClose(): void
}

/**
 * Production > Revision Sets: start a colored set (edits made while it is
 * active get margin asterisks), end it when the draft goes out.
 */
export function RevisionSetsDialog({
  sets,
  activeSetId,
  onStart,
  onEndActive,
  onClose
}: Props): React.JSX.Element {
  const color = nextRevisionColor(sets.length)
  const [name, setName] = useState(`${color} Revision`)
  const active = sets.find((s) => s.id === activeSetId)

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Revision Sets</h2>
        <p className="hint">
          While a set is active, everything you edit gets its colored asterisk in the margin, in
          the editor and the exported PDF. Marks live in the planning sidecar; the script file
          stays clean.
        </p>
        {sets.length > 0 && (
          <ol className="revision-list">
            {sets.map((s) => (
              <li key={s.id} className={s.id === activeSetId ? 'active' : ''}>
                <span
                  className="storyline-dot"
                  style={{ background: revisionColorValue(s.color) }}
                />
                <span className="rev-name">{s.name}</span>
                <span className="rev-dates">
                  {s.startedAt.slice(0, 10)}
                  {s.closedAt ? ` to ${s.closedAt.slice(0, 10)}` : s.id === activeSetId ? ' · active' : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
        {active ? (
          <div className="dialog-buttons spread">
            <button className="danger" onClick={onEndActive}>
              End “{active.name}”
            </button>
            <button className="primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <label>
              New set name (color: {color})
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <div className="dialog-buttons">
              <button onClick={onClose}>Close</button>
              <button
                className="primary"
                disabled={!name.trim()}
                onClick={() => {
                  onStart(name.trim(), color)
                  onClose()
                }}
              >
                Start Set
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
