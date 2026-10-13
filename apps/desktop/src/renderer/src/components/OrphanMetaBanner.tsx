import { useState } from 'react'
import type { SceneMeta } from '@spec/core'
import { colorValue } from '../planning/colors'

interface Props {
  orphans: SceneMeta[]
  scenes: Array<{ id: string; heading: string }>
  onAttach(orphanId: string, sceneId: string): void
  onRemove(orphanId: string): void
  onDismiss(): void
}

/**
 * Shown when planning entries (colors, tags, tension) no longer match any
 * scene in the open script: a heading was rewritten, or a scene was cut.
 * Nothing is lost silently; the writer re-attaches each entry to a scene,
 * or discards it on purpose.
 */
export function OrphanMetaBanner({
  orphans,
  scenes,
  onAttach,
  onRemove,
  onDismiss
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [picks, setPicks] = useState<Record<string, string>>({})

  const summary = (o: SceneMeta): string => {
    const bits: string[] = []
    if (o.color) bits.push(o.color)
    if (o.tags?.length) bits.push(o.tags.join(', '))
    if (o.tension !== undefined) bits.push(`tension ${o.tension}`)
    if (o.storylines?.length) bits.push(`${o.storylines.length} storyline${o.storylines.length === 1 ? '' : 's'}`)
    return bits.join(' · ') || 'empty entry'
  }

  return (
    <>
      <div className="orphan-banner" role="status">
        <span>
          {orphans.length === 1
            ? '1 planning entry (color, tags, tension) no longer matches any scene.'
            : `${orphans.length} planning entries (colors, tags, tension) no longer match any scene.`}
        </span>
        <button className="primary" onClick={() => setOpen(true)}>
          Review…
        </button>
        <button onClick={onDismiss} title="Keep them in the sidecar and hide this for now">
          Later
        </button>
      </div>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Planning entries without a scene</h2>
            <p className="hint">
              Each entry remembers the heading it belonged to. Pick the scene it should attach to
              now, or remove it if that scene is gone for good. Nothing is deleted until you say
              so.
            </p>
            <ol className="orphan-list">
              {orphans.map((o) => (
                <li key={o.id} className="orphan-item">
                  <div className="orphan-info">
                    {o.color && (
                      <span
                        className="storyline-dot"
                        style={{ background: colorValue(o.color) ?? undefined }}
                      />
                    )}
                    <span className="orphan-heading">{o.heading || '(no heading recorded)'}</span>
                    <span className="orphan-summary">{summary(o)}</span>
                  </div>
                  <div className="orphan-actions">
                    <select
                      value={picks[o.id] ?? ''}
                      onChange={(e) => setPicks({ ...picks, [o.id]: e.target.value })}
                    >
                      <option value="">Choose a scene…</option>
                      {scenes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.heading || '(empty heading)'}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      disabled={!picks[o.id]}
                      onClick={() => onAttach(o.id, picks[o.id]!)}
                    >
                      Attach
                    </button>
                    <button className="danger" onClick={() => onRemove(o.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="dialog-buttons">
              <button className="primary" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
