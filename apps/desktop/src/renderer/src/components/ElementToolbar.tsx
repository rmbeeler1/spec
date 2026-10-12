import type { ElementType } from '@spec/core'
import { CYCLE_TYPES } from '../editor/schema'

const LABELS: Record<string, string> = {
  scene_heading: 'Scene',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parens',
  transition: 'Transition'
}

interface Props {
  currentType: ElementType | null
  modKey: string // "⌘" on mac, "Ctrl" elsewhere
  onSetType(type: ElementType): void
  onHelp(): void
}

export function ElementToolbar({ currentType, modKey, onSetType, onHelp }: Props): React.JSX.Element {
  return (
    <div className="element-toolbar" role="toolbar" aria-label="Element type">
      {CYCLE_TYPES.map((type, i) => (
        <button
          key={type}
          className={currentType === type ? 'active' : ''}
          onClick={() => onSetType(type)}
          title={`Make this line a ${LABELS[type]} (${modKey}${i + 1})`}
        >
          <span className="tb-label">{LABELS[type]}</span>
          <span className="tb-key">
            {modKey}
            {i + 1}
          </span>
        </button>
      ))}
      <span className="tb-tip">Tab cycles · Enter flows</span>
      <button className="tb-help" onClick={onHelp} title="Keyboard shortcuts">
        ? Help
      </button>
    </div>
  )
}
