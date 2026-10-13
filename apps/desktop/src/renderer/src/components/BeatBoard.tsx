import { useRef, useState } from 'react'
import type { BeatCard, BeatLink } from '@spec/core'
import { CARD_COLORS, colorValue } from '../planning/colors'

interface Props {
  beats: BeatCard[]
  links: BeatLink[]
  onUpsert(beat: BeatCard): void
  onRemove(beatId: string): void
  onToggleLink(link: BeatLink): void
}

const CARD_W = 210
const CARD_H = 120
const BOARD_W = 2400
const BOARD_H = 1600

function newBeatId(): string {
  return `beat-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

/**
 * Freeform canvas of beat cards. Drag to move, double-click to edit, link
 * mode connects two cards with a flow line (click a selected line's × to
 * remove it). Planning-only: nothing here touches the Fountain file.
 */
export function BeatBoard({ beats, links, onUpsert, onRemove, onToggleLink }: Props): React.JSX.Element {
  const [editing, setEditing] = useState<BeatCard | null>(null)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [selectedLink, setSelectedLink] = useState<BeatLink | null>(null)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const addBeat = (): void => {
    const index = beats.length
    const beat: BeatCard = {
      id: newBeatId(),
      title: '',
      body: '',
      x: 40 + (index % 5) * (CARD_W + 30),
      y: 40 + Math.floor(index / 5) * (CARD_H + 30)
    }
    onUpsert(beat)
    setEditing(beat)
  }

  const startDrag = (e: React.PointerEvent, beat: BeatCard): void => {
    if ((e.target as HTMLElement).closest('button')) return
    // rect is the canvas itself, which moves with the scroll, so client
    // coordinates minus rect origin are already board coordinates
    const rect = boardRef.current!.getBoundingClientRect()
    drag.current = {
      id: beat.id,
      dx: e.clientX - rect.left - beat.x,
      dy: e.clientY - rect.top - beat.y
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: React.PointerEvent, beat: BeatCard): void => {
    if (!drag.current || drag.current.id !== beat.id) return
    const rect = boardRef.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(BOARD_W - CARD_W, e.clientX - rect.left - drag.current.dx))
    const y = Math.max(0, Math.min(BOARD_H - CARD_H, e.clientY - rect.top - drag.current.dy))
    onUpsert({ ...beat, x, y })
  }

  const center = (b: BeatCard): { x: number; y: number } => ({
    x: b.x + CARD_W / 2,
    y: b.y + CARD_H / 2
  })

  return (
    <div className="beatboard">
      <div className="board-toolbar">
        <button className="primary-action" onClick={addBeat}>
          + Beat
        </button>
        {linkFrom && (
          <span className="hint">
            Linking: click the ⚯ on another card to connect, or{' '}
            <button onClick={() => setLinkFrom(null)}>cancel</button>
          </span>
        )}
        {beats.length === 0 && !linkFrom && (
          <span className="hint">
            Beats are planning-only cards: ideas, set pieces, promises to keep. They never appear
            in the script.
          </span>
        )}
      </div>
      <div className="board-scroll">
        <div
          className="board-canvas"
          ref={boardRef}
          style={{ width: BOARD_W, height: BOARD_H }}
          onClick={() => setSelectedLink(null)}
        >
          <svg className="board-links" width={BOARD_W} height={BOARD_H}>
            {links.map((l) => {
              const a = beats.find((b) => b.id === l.from)
              const b = beats.find((bb) => bb.id === l.to)
              if (!a || !b) return null
              const ca = center(a)
              const cb = center(b)
              const isSelected =
                selectedLink && selectedLink.from === l.from && selectedLink.to === l.to
              return (
                <g key={`${l.from}-${l.to}`}>
                  <line
                    className="board-link-hit"
                    x1={ca.x}
                    y1={ca.y}
                    x2={cb.x}
                    y2={cb.y}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedLink(l)
                    }}
                  />
                  <line
                    className={`board-link${isSelected ? ' selected' : ''}`}
                    x1={ca.x}
                    y1={ca.y}
                    x2={cb.x}
                    y2={cb.y}
                  />
                </g>
              )
            })}
          </svg>
          {selectedLink &&
            (() => {
              const a = beats.find((b) => b.id === selectedLink.from)
              const b = beats.find((bb) => bb.id === selectedLink.to)
              if (!a || !b) return null
              const mx = (center(a).x + center(b).x) / 2
              const my = (center(a).y + center(b).y) / 2
              return (
                <button
                  className="link-delete"
                  style={{ left: mx - 11, top: my - 11 }}
                  title="Remove this flow line"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleLink(selectedLink)
                    setSelectedLink(null)
                  }}
                >
                  ×
                </button>
              )
            })()}
          {beats.map((beat) => (
            <div
              key={beat.id}
              className={`beat-card${linkFrom === beat.id ? ' link-source' : ''}`}
              style={{ left: beat.x, top: beat.y, width: CARD_W, minHeight: CARD_H }}
              onPointerDown={(e) => startDrag(e, beat)}
              onPointerMove={(e) => moveDrag(e, beat)}
              onPointerUp={() => (drag.current = null)}
              onDoubleClick={() => setEditing(beat)}
              title="Drag to move · double-click to edit"
            >
              {beat.color && (
                <div className="card-color" style={{ background: colorValue(beat.color) ?? undefined }} />
              )}
              <div className="beat-title">{beat.title || 'Untitled beat'}</div>
              <div className="beat-body">{beat.body}</div>
              <div className="card-foot">
                {(beat.tags ?? []).map((t) => (
                  <span key={t} className="card-tag">
                    {t}
                  </span>
                ))}
                <button
                  className="beat-link-btn"
                  title={linkFrom ? 'Link to this card' : 'Start a flow line from this card'}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (linkFrom === null) setLinkFrom(beat.id)
                    else {
                      if (linkFrom !== beat.id) onToggleLink({ from: linkFrom, to: beat.id })
                      setLinkFrom(null)
                    }
                  }}
                >
                  ⚯
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {editing && (
        <BeatEditDialog
          beat={beats.find((b) => b.id === editing.id) ?? editing}
          onSave={(b) => {
            onUpsert(b)
            setEditing(null)
          }}
          onDelete={() => {
            onRemove(editing.id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function BeatEditDialog({
  beat,
  onSave,
  onDelete,
  onClose
}: {
  beat: BeatCard
  onSave(beat: BeatCard): void
  onDelete(): void
  onClose(): void
}): React.JSX.Element {
  const [title, setTitle] = useState(beat.title)
  const [body, setBody] = useState(beat.body)
  const [color, setColor] = useState(beat.color)
  const [tags, setTags] = useState((beat.tags ?? []).join(', '))

  const save = (): void =>
    onSave({
      ...beat,
      title: title.trim(),
      body: body.trim(),
      color,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    })

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Beat</h2>
        <label>
          Title
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Notes
          <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="meta-row">
          <span className="meta-label">Color</span>
          <div className="color-swatches">
            <button
              className={`swatch none${color ? '' : ' selected'}`}
              onClick={() => setColor(undefined)}
            >
              ∅
            </button>
            {CARD_COLORS.map((c) => (
              <button
                key={c.name}
                className={`swatch${color === c.name ? ' selected' : ''}`}
                style={{ background: c.value }}
                title={c.name}
                onClick={() => setColor(c.name)}
              />
            ))}
          </div>
        </div>
        <label>
          Tags (comma separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <div className="dialog-buttons spread">
          <button className="danger" onClick={onDelete}>
            Delete Beat
          </button>
          <span>
            <button onClick={onClose}>Cancel</button>
            <button className="primary" onClick={save}>
              Save
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
