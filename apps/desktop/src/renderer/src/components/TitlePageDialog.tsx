import { useState } from 'react'
import type { TitlePageEntry } from '@spec/core'

/** The common title page keys, edited as simple fields. */
const FIELDS: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: 'Title', label: 'Title' },
  { key: 'Credit', label: 'Credit (e.g. Written by)' },
  { key: 'Author', label: 'Author' },
  { key: 'Source', label: 'Source (e.g. based on…)' },
  { key: 'Draft date', label: 'Draft date' },
  { key: 'Contact', label: 'Contact', multiline: true },
  { key: 'Copyright', label: 'Copyright' }
]

interface Props {
  titlePage: TitlePageEntry[]
  onApply(entries: TitlePageEntry[]): void
  onClose(): void
}

export function TitlePageDialog({ titlePage, onApply, onClose }: Props): React.JSX.Element {
  const initial: Record<string, string> = {}
  for (const f of FIELDS) {
    const entry = titlePage.find((e) => e.key.toLowerCase() === f.key.toLowerCase())
    initial[f.key] = entry ? entry.values.join('\n') : ''
  }
  const [values, setValues] = useState(initial)

  const apply = (): void => {
    const entries: TitlePageEntry[] = []
    for (const f of FIELDS) {
      const lines = (values[f.key] ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
      if (lines.length > 0) entries.push({ key: f.key, values: lines })
    }
    // Keep any keys we do not edit (custom keys from imported files)
    for (const entry of titlePage) {
      if (!FIELDS.some((f) => f.key.toLowerCase() === entry.key.toLowerCase())) {
        entries.push(entry)
      }
    }
    onApply(entries)
    onClose()
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Title Page</h2>
        {FIELDS.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.multiline ? (
              <textarea
                rows={3}
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            ) : (
              <input
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}
        <div className="dialog-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
