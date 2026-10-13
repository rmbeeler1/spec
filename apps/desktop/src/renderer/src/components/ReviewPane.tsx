import { useMemo, useState } from 'react'
import { buildScript, type ClassifiedLine, type ClassifiedType, type Script, type TitlePageEntry } from '@spec/core'
import {
  DOUBT_THRESHOLD,
  applyTypeToSelection,
  doubtfulCount,
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
  const [doubtfulFirst, setDoubtfulFirst] = useState(false)
  const [lastClicked, setLastClicked] = useState<number | null>(null)
  const [bulkType, setBulkType] = useState<ClassifiedType>('action')

  const indices = useMemo(() => visibleIndices(lines, doubtfulFirst), [lines, doubtfulFirst])
  const doubtful = useMemo(() => doubtfulCount(lines), [lines])

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
          <p className="hint">
            {indices.length} lines · {doubtful} worth a look (confidence under{' '}
            {Math.round(DOUBT_THRESHOLD * 100)}%). Click rows to select, shift-click for a range,
            then set their type in one go.
          </p>
        </div>
        <div className="review-controls">
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
