import { useRef, useState } from 'react'
import type { SceneInfo } from '../editor/scenes'

interface Props {
  scenes: SceneInfo[]
  onJump(pos: number): void
  onMove(index: number, direction: 'up' | 'down'): void
}

const MIN_WIDTH = 170
const MAX_WIDTH = 460
const DEFAULT_WIDTH = 250

export function clampNavWidth(width: number): number {
  if (Number.isNaN(width)) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

function storedWidth(): number {
  return clampNavWidth(Number(localStorage.getItem('spec:nav-width') ?? DEFAULT_WIDTH))
}

export function SceneNavigator({ scenes, onJump, onMove }: Props): React.JSX.Element {
  const [width, setWidth] = useState(storedWidth)
  const dragging = useRef(false)

  const startDrag = (e: React.PointerEvent): void => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const drag = (e: React.PointerEvent): void => {
    if (!dragging.current) return
    setWidth(clampNavWidth(e.clientX))
  }
  const endDrag = (): void => {
    if (!dragging.current) return
    dragging.current = false
    localStorage.setItem('spec:nav-width', String(width))
  }

  return (
    <aside className="scene-nav" style={{ width }}>
      <div className="scene-nav-inner">
        <h2>Scenes</h2>
        {scenes.length === 0 && <p className="empty">No scenes yet.</p>}
        <ol>
          {scenes.map((scene, i) => (
            <li key={`${scene.pos}-${i}`}>
              <button
                className="scene-jump"
                onClick={() => onJump(scene.pos)}
                title={scene.heading}
              >
                <span className="scene-num">{scene.sceneNumber ?? i + 1}</span>
                <span className="scene-title">{scene.heading || '(empty heading)'}</span>
              </button>
              <span className="scene-move">
                <button
                  aria-label="Move scene up"
                  disabled={i === 0}
                  onClick={() => onMove(i, 'up')}
                >
                  ↑
                </button>
                <button
                  aria-label="Move scene down"
                  disabled={i === scenes.length - 1}
                  onClick={() => onMove(i, 'down')}
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div
        className="scene-nav-resizer"
        role="separator"
        aria-label="Resize scene list"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </aside>
  )
}
