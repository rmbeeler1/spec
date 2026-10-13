import type { StructureInfo } from '../editor/scenes'
import { formatEighths, type SceneCard } from '../planning/cards'
import { colorValue } from '../planning/colors'

interface Props {
  structure: StructureInfo[]
  cards: SceneCard[]
  onJump(pos: number): void
}

/**
 * The outline as lanes: acts (#) in the first column, sequences (##) in the
 * second, scenes and deeper sections in the third. Clicking anything jumps
 * the editor there.
 */
export function OutlineView({ structure, cards, onJump }: Props): React.JSX.Element {
  const cardById = new Map(cards.map((c) => [c.id, c]))

  return (
    <div className="outline">
      <div className="outline-lanes-header">
        <span>Acts</span>
        <span>Sequences</span>
        <span>Scenes</span>
      </div>
      {structure.length === 0 && (
        <p className="empty board-empty">
          Nothing to outline yet. Scene headings appear here; # section lines group them into acts
          and sequences.
        </p>
      )}
      <div className="outline-rows">
        {structure.map((item, i) => {
          const lane = item.kind === 'scene' ? 3 : Math.min(item.depth, 3)
          const card = item.kind === 'scene' && item.id ? cardById.get(item.id) : undefined
          return (
            <button
              key={`${item.pos}-${i}`}
              className={`outline-row lane-${lane} ${item.kind}`}
              onClick={() => onJump(item.pos)}
              title="Click to open in the editor"
            >
              {card?.color && (
                <span
                  className="storyline-dot"
                  style={{ background: colorValue(card.color) ?? undefined }}
                />
              )}
              <span className="outline-text">{item.text || '(untitled)'}</span>
              {card && (
                <span className="outline-meta">
                  {formatEighths(card.eighths)} pg · p.{card.startPage}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
