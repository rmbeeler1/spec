import { useMemo, useState } from 'react'
import { buildScript, type ClassifiedLine, type ClassifiedType, type Script, type TitlePageEntry } from '@spec/core'
import {
  DOUBT_THRESHOLD,
  applyTypeToSelection,
  importSummary,
  rangeBetween,
  selectDoubtful,
  visibleIndices
} from '../import/reviewLogic'

const TYPE_OPTIONS: Array<{ value: ClassifiedType; label: string }> = [
  { value: 'scene_heading', label: 'Scene Heading' },
  { value: 'action', label: 'Action' },
  { value: 'character', label: 'Character' },
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'parenthetical', label: 'Parenthetical' },
  { value: 'transition', label: 'Transition' },
  { value: 'shot', label: 'Shot' },
  { value: 'centered', label: 'Centered' },
  { value: 'section', label: 'Section' },
  { value: 'synopsis', label: 'Synopsis' },
  { value: 'lyric', label: 'Lyric' }
]

const SHORT_LABEL: Partial<Record<ClassifiedType, string>> = {
  scene_heading: 'Scene',
  action: 'Action',
  character: 'Char',
  dialogue: 'Dialog',
  parenthetical: 'Parens',
  transition: 'Trans',
  shot: 'Shot',
  centered: 'Center',
  section: 'Section',
  synopsis: 'Synopsis',
  lyric: 'Lyric'
}

interface Props {
  fileName: string
  lines: ClassifiedLine[]
  titlePage: TitlePageEntry[]
  onCommit(script: Script): void
  onCancel(): void
}

export function ReviewPane({ fileName, lines: initial, titlePage, onCommit, onCancel }: Props): React.JSX.Element {
  const [lines, setLines] = useState(initial)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [doubtfulFirst, setDoubtfulFirst] = useState(true)
  const [lastClicked, setLastClicked] = useState<number | null>(null)
  const [bulkType, setBulkType] = useState<ClassifiedType>('action')

  const indices = useMemo(() => visibleIndices(lines, doubtfulFirst), [lines, doubtfulFirst])
  const summary = useMemo(() => importSummary(lines), [lines])

  const onRowClick = (index: number, shiftKey: boolean): void => {
    setSelected((prev) => {
      if (shiftKey && lastClicked !== null) {
        const range = rangeBetween(indices, lastClicked, index)
        const next = new Set(prev)
        for (const i of range) next.add(i)
        return next
      }
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    setLastClicked(index)
  }

  const applyBulk = (): void => {
    if (selected.size === 0) return
    setLines((prev) => applyTypeToSelection(prev, selected, bulkType))
    setSelected(new Set())
  }

  return (
    <div className="review-pane">
      <header className="review-header">
        <div>
          <h2>Review import: {fileName}</h2>
          <p className={`summary${summary.suspicious ? ' suspicious' : ''}`}>{summary.text}</p>
          <p className="hint">
            What to do here: skim the flagged lines at the top. If a line has the wrong type, click
            it (shift-click for a range), pick the right type, and press Set type. If everything
            looks right, just press Import — you can still edit anything afterwards.
          </p>
        </div>
        <div className="review-controls">
          <button className="primary review-cta" onClick={() => onCommit(buildScript(lines, titlePage))}>
            Looks right — import {indices.length} lines
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={doubtfulFirst}
              onChange={(e) => setDoubtfulFirst(e.target.checked)}
            />
            Doubtful first
          </label>
          <button onClick={() => setSelected(selectDoubtful(lines))}>Select doubtful</button>
          <select value={bulkType} onChange={(e) => setBulkType(e.target.value as ClassifiedType)}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button onClick={applyBulk} disabled={selected.size === 0}>
            Set type on {selected.size || '…'} selected
          </button>
        </div>
      </header>

      <div className="review-table-wrap">
        <table className="review-table">
          <tbody>
            {indices.map((i) => {
              const line = lines[i]!
              const isDoubtful = line.confidence < DOUBT_THRESHOLD
              return (
                <tr
                  key={i}
                  className={`${selected.has(i) ? 'selected' : ''} ${isDoubtful ? 'doubtful' : ''}`}
                  onClick={(e) => onRowClick(i, e.shiftKey)}
                >
                  <td className={`rt-type rt-${line.type}`}>{SHORT_LABEL[line.type] ?? line.type}</td>
                  <td className="rt-conf">{Math.round(line.confidence * 100)}%</td>
                  <td className="rt-text">{line.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <footer className="review-footer">
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={() => onCommit(buildScript(lines, titlePage))}>
          Import into editor
        </button>
      </footer>
    </div>
  )
}
