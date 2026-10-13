import { useRef, useState } from 'react'
import type { Storyline } from '@spec/core'
import { colorValue } from '../planning/colors'
import { formatEighths, type SceneCard } from '../planning/cards'
import { SceneMetaPopover } from './SceneMetaPopover'

interface Props {
  cards: SceneCard[]
  storylines: Storyline[]
  onReorder(fromIndex: number, toIndex: number): void
  onOpenScene(sceneId: string): void
  onEditSynopsis(sceneId: string, text: string): void
  onSetColor(card: SceneCard, color: string | undefined): void
  onSetTags(card: SceneCard, tags: string[]): void
  onToggleStoryline(card: SceneCard, storylineId: string): void
  onCreateStoryline(name: string, color: string): void
}

/**
 * One index card per scene, script order. Drag a card onto another to move
 * it there (the script itself reorders). Double-click opens the scene in the
 * editor; clicking the body edits the synopsis in place.
 */
export function Corkboard(props: Props): React.JSX.Element {
  const { cards, storylines } = props
  // A ref, not state: drop must read the value synchronously even when the
  // drag events arrive faster than React flushes renders.
  const dragIndex = useRef<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [metaCardId, setMetaCardId] = useState<string | null>(null)

  const metaCard = metaCardId ? cards.find((c) => c.id === metaCardId) : undefined

  const commitSynopsis = (card: SceneCard): void => {
    setEditingId(null)
    if (editText.trim() !== (card.bodyIsFallback ? '' : card.body)) {
      props.onEditSynopsis(card.id, editText)
    }
  }

  return (
    <div className="corkboard">
      {cards.length === 0 && (
        <p className="empty board-empty">No scenes yet. Write a scene heading and it becomes a card.</p>
      )}
      <div className="corkboard-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`scene-card${dropIndex === card.index && dragIndex.current !== card.index ? ' drop-target' : ''}`}
            draggable={editingId !== card.id}
            onDragStart={(e) => {
              dragIndex.current = card.index
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDropIndex(card.index)
            }}
            onDragLeave={() => setDropIndex((d) => (d === card.index ? null : d))}
            onDrop={(e) => {
              e.preventDefault()
              const from = dragIndex.current
              if (from !== null && from !== card.index) {
                props.onReorder(from, card.index)
              }
              dragIndex.current = null
              setDropIndex(null)
            }}
            onDragEnd={() => {
              dragIndex.current = null
              setDropIndex(null)
            }}
            onDoubleClick={() => props.onOpenScene(card.id)}
            title="Drag to reorder · double-click to open in the editor"
          >
            {card.color && (
              <div className="card-color" style={{ background: colorValue(card.color) ?? undefined }} />
            )}
            <div className="card-top">
              <span className="card-num">{card.sceneNumber ?? card.index + 1}</span>
              <span className="card-heading">{card.heading || '(empty heading)'}</span>
              <button
                className="card-menu"
                title="Color, tags, storylines"
                onClick={(e) => {
                  e.stopPropagation()
                  setMetaCardId(card.id)
                }}
              >
                ⋯
              </button>
            </div>
            {editingId === card.id ? (
              <textarea
                className="card-body-edit"
                autoFocus
                value={editText}
                placeholder="Synopsis"
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => commitSynopsis(card)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    commitSynopsis(card)
                  }
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <div
                className={`card-body${card.bodyIsFallback ? ' fallback' : ''}`}
                title="Click to edit the synopsis"
                onClick={() => {
                  setEditingId(card.id)
                  setEditText(card.bodyIsFallback ? '' : card.body)
                }}
              >
                {card.body || <span className="card-placeholder">Click to add a synopsis</span>}
              </div>
            )}
            <div className="card-foot">
              <span>{formatEighths(card.eighths)} pg</span>
              {card.tags.map((t) => (
                <span key={t} className="card-tag">
                  {t}
                </span>
              ))}
              {card.storylines.map((id) => {
                const sl = storylines.find((s) => s.id === id)
                return sl ? (
                  <span
                    key={id}
                    className="storyline-dot"
                    title={sl.name}
                    style={{ background: colorValue(sl.color) ?? '#999' }}
                  />
                ) : null
              })}
            </div>
          </div>
        ))}
      </div>
      {metaCard && (
        <SceneMetaPopover
          card={metaCard}
          storylines={storylines}
          onSetColor={(c) => props.onSetColor(metaCard, c)}
          onSetTags={(t) => props.onSetTags(metaCard, t)}
          onToggleStoryline={(id) => props.onToggleStoryline(metaCard, id)}
          onCreateStoryline={props.onCreateStoryline}
          onClose={() => setMetaCardId(null)}
        />
      )}
    </div>
  )
}
