import { useState } from 'react'
import type { WritingGoal } from '@spec/core'

interface Props {
  goal: WritingGoal | undefined
  onApply(goal: WritingGoal | undefined): void
  onClose(): void
}

/** Production > Writing Goal: a per-script daily target, shown in the status bar. */
export function GoalDialog({ goal, onApply, onClose }: Props): React.JSX.Element {
  const [kind, setKind] = useState<WritingGoal['kind']>(goal?.kind ?? 'words')
  const [perDay, setPerDay] = useState(String(goal?.perDay ?? (goal?.kind === 'pages' ? 3 : 500)))
  const n = parseInt(perDay, 10)
  const valid = Number.isFinite(n) && n > 0

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Writing Goal</h2>
        <p className="hint">
          A daily target for this script. Progress shows in the status bar; history lives in the
          Reports view under Writing. Deleting text never counts against you, and imports never
          count for you.
        </p>
        <label>
          Measure
          <select value={kind} onChange={(e) => setKind(e.target.value as WritingGoal['kind'])}>
            <option value="words">Words per day</option>
            <option value="pages">Pages per day</option>
          </select>
        </label>
        <label>
          Target
          <input
            type="number"
            min={1}
            value={perDay}
            onChange={(e) => setPerDay(e.target.value)}
            autoFocus
          />
        </label>
        <div className="dialog-buttons spread">
          <button
            onClick={() => {
              onApply(undefined)
              onClose()
            }}
          >
            Clear Goal
          </button>
          <span>
            <button onClick={onClose}>Cancel</button>
            <button
              className="primary"
              disabled={!valid}
              onClick={() => {
                onApply({ kind, perDay: n })
                onClose()
              }}
            >
              Set Goal
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
