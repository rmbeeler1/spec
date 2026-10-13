import { useEffect, useRef, useState } from 'react'
import type { Storyline } from '@spec/core'
import { colorValue } from '../planning/colors'
import { formatEighths, formatMinutes, type PacingLane, type SceneCard } from '../planning/cards'

interface Props {
  cards: SceneCard[]
  lanes: PacingLane[]
  storylines: Storyline[]
  onSetTension(card: SceneCard, tension: number | null): void
  onOpenScene(sceneId: string): void
}

/**
 * The pacing storyboard: scene cards left to right as a timeline with act
 * dividers from # sections, and a strip above drawing the tension curve
 * across the whole script. Unset tension is a gap in the curve, never a zero.
 */
export function PacingBoard({
  cards,
  lanes,
  storylines,
  onSetTension,
  onOpenScene
}: Props): React.JSX.Element {
  return (
    <div className="pacing">
      <TensionStrip cards={cards} lanes={lanes} onOpenScene={onOpenScene} />
      <div className="pacing-lanes">
        {lanes.map((lane, li) => (
          <section key={li} className="pacing-lane">
            {lane.title !== null && <h3 className="lane-title">{lane.title}</h3>}
            <div className="lane-cards">
              {lane.cardIndexes.map((ci) => {
                const card = cards[ci]
                if (!card) return null
                return (
                  <div
                    key={card.id}
                    className="pacing-card"
                    onDoubleClick={() => onOpenScene(card.id)}
                    title="Double-click to open in the editor"
                  >
                    {card.color && (
                      <div
                        className="card-color"
                        style={{ background: colorValue(card.color) ?? undefined }}
                      />
                    )}
                    <div className="pc-heading">
                      <span className="card-num">{card.index + 1}</span>
                      {card.heading || '(empty heading)'}
                    </div>
                    <div className="pc-facts">
                      {card.intExt && <span className="pc-fact">{card.intExt}</span>}
                      {card.timeOfDay && <span className="pc-fact">{card.timeOfDay}</span>}
                      <span className="pc-fact">{formatEighths(card.eighths)} pg</span>
                      <span className="pc-fact">{formatMinutes(card.pages)}</span>
                      <span className="pc-fact muted">p.{card.startPage}</span>
                    </div>
                    <div className="pc-storylines">
                      {card.storylines.map((id) => {
                        const sl = storylines.find((s) => s.id === id)
                        return sl ? (
                          <span key={id} className="pc-storyline">
                            <span
                              className="storyline-dot"
                              style={{ background: colorValue(sl.color) ?? '#999' }}
                            />
                            {sl.name}
                          </span>
                        ) : null
                      })}
                    </div>
                    <div
                      className="tension-dots"
                      role="radiogroup"
                      aria-label={`Tension for scene ${card.index + 1}`}
                    >
                      <span className="tension-label">Tension</span>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          role="radio"
                          aria-checked={card.tension === v}
                          className={`tension-dot${card.tension !== null && card.tension >= v ? ' on' : ''}`}
                          title={card.tension === v ? 'Click to unset' : `Tension ${v}`}
                          onClick={() => onSetTension(card, card.tension === v ? null : v)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/** The energy curve: one point per scene, line broken where tension is unset. */
function TensionStrip({
  cards,
  lanes,
  onOpenScene
}: {
  cards: SceneCard[]
  lanes: PacingLane[]
  onOpenScene(sceneId: string): void
}): React.JSX.Element {
  // Draw at real pixel size (measured container), so text never distorts;
  // scripts with more scenes than fit get a horizontally scrolling strip.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(900)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = (): void => setMeasured(Math.max(300, el.clientWidth))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = Math.max(measured, cards.length * 22)
  const H = 96
  const PAD = { left: 30, right: 12, top: 12, bottom: 18 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number): number =>
    PAD.left + (cards.length <= 1 ? innerW / 2 : (i / (cards.length - 1)) * innerW)
  const y = (t: number): number => PAD.top + innerH - ((t - 1) / 4) * innerH

  // Line segments between consecutive SET values; unset scenes break the line
  const segments: string[] = []
  let run: string[] = []
  cards.forEach((c, i) => {
    if (c.tension === null) {
      if (run.length > 1) segments.push(run.join(' '))
      run = []
    } else {
      run.push(`${x(i)},${y(c.tension)}`)
    }
  })
  if (run.length > 1) segments.push(run.join(' '))

  // Act divider positions: the first card index of each titled lane
  const dividers = lanes
    .filter((l) => l.title !== null && l.cardIndexes.length > 0)
    .map((l) => ({ title: l.title!, at: l.cardIndexes[0]! }))

  const hasAny = cards.some((c) => c.tension !== null)

  return (
    <div
      className="tension-strip"
      role="img"
      aria-label="Tension across the script"
      ref={wrapRef}
    >
      <svg width={W} height={H} className="tension-svg">
        {[1, 3, 5].map((t) => (
          <g key={t}>
            <line className="strip-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="strip-tick" x={PAD.left - 6} y={y(t) + 3}>
              {t}
            </text>
          </g>
        ))}
        {dividers.map((d) => (
          <g key={`${d.title}-${d.at}`}>
            <line
              className="strip-act"
              x1={x(d.at)}
              x2={x(d.at)}
              y1={PAD.top - 4}
              y2={H - PAD.bottom}
            />
            <text className="strip-act-label" x={x(d.at) + 4} y={PAD.top + 2}>
              {d.title}
            </text>
          </g>
        ))}
        {segments.map((points, i) => (
          <polyline key={i} className="strip-line" points={points} />
        ))}
        {cards.map((c, i) =>
          c.tension !== null ? (
            <circle
              key={c.id}
              className="strip-point"
              cx={x(i)}
              cy={y(c.tension)}
              r={4}
              onClick={() => onOpenScene(c.id)}
            >
              <title>{`${i + 1}. ${c.heading} — tension ${c.tension}`}</title>
            </circle>
          ) : null
        )}
      </svg>
      {!hasAny && (
        <p className="strip-hint">
          Set tension on the cards below and the curve of the script appears here.
        </p>
      )}
    </div>
  )
}
