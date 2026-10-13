import { useState } from 'react'
import type { Storyline } from '@spec/core'
import { CARD_COLORS, colorValue, nextStorylineColor } from '../planning/colors'
import type { SceneCard } from '../planning/cards'

interface Props {
  card: SceneCard
  storylines: Storyline[]
  onSetColor(color: string | undefined): void
  onSetTags(tags: string[]): void
  onToggleStoryline(storylineId: string): void
  onCreateStoryline(name: string, color: string): void
  onClose(): void
}

/** Color, tags and storylines for one scene, as a small dialog. */
export function SceneMetaPopover({
  card,
  storylines,
  onSetColor,
  onSetTags,
  onToggleStoryline,
  onCreateStoryline,
  onClose
}: Props): React.JSX.Element {
  const [tagText, setTagText] = useState(card.tags.join(', '))
  const [newStoryline, setNewStoryline] = useState('')

  const applyTags = (): void => {
    const tags = tagText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    onSetTags(tags)
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog scene-meta" onClick={(e) => e.stopPropagation()}>
        <h2 className="scene-meta-heading">{card.heading || '(empty heading)'}</h2>

        <div className="meta-row">
          <span className="meta-label">Color</span>
          <div className="color-swatches">
            <button
              className={`swatch none${card.color ? '' : ' selected'}`}
              title="No color"
              onClick={() => onSetColor(undefined)}
            >
              ∅
            </button>
            {CARD_COLORS.map((c) => (
              <button
                key={c.name}
                className={`swatch${card.color === c.name ? ' selected' : ''}`}
                style={{ background: c.value }}
                title={c.name}
                onClick={() => onSetColor(c.name)}
              />
            ))}
          </div>
        </div>

        <label>
          Tags (comma separated)
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onBlur={applyTags}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyTags()
            }}
            placeholder="setup, maya, flashback"
          />
        </label>

        <div className="meta-row">
          <span className="meta-label">Storylines</span>
          <div className="storyline-list">
            {storylines.length === 0 && (
              <span className="hint">None yet. Create one below; it becomes assignable to any scene.</span>
            )}
            {storylines.map((sl) => (
              <label key={sl.id} className="storyline-item">
                <input
                  type="checkbox"
                  checked={card.storylines.includes(sl.id)}
                  onChange={() => onToggleStoryline(sl.id)}
                />
                <span className="storyline-dot" style={{ background: colorValue(sl.color) ?? '#999' }} />
                {sl.name}
              </label>
            ))}
            <div className="storyline-new">
              <input
                value={newStoryline}
                onChange={(e) => setNewStoryline(e.target.value)}
                placeholder="New storyline name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newStoryline.trim()) {
                    onCreateStoryline(newStoryline.trim(), nextStorylineColor(storylines.length))
                    setNewStoryline('')
                  }
                }}
              />
              <button
                disabled={!newStoryline.trim()}
                onClick={() => {
                  onCreateStoryline(newStoryline.trim(), nextStorylineColor(storylines.length))
                  setNewStoryline('')
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="dialog-buttons">
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
