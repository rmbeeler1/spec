import type { SceneInfo } from '../editor/scenes'

interface Props {
  scenes: SceneInfo[]
  onJump(pos: number): void
  onMove(index: number, direction: 'up' | 'down'): void
}

export function SceneNavigator({ scenes, onJump, onMove }: Props): React.JSX.Element {
  return (
    <aside className="scene-nav">
      <h2>Scenes</h2>
      {scenes.length === 0 && <p className="empty">No scenes yet.</p>}
      <ol>
        {scenes.map((scene, i) => (
          <li key={`${scene.pos}-${i}`}>
            <button className="scene-jump" onClick={() => onJump(scene.pos)} title={scene.heading}>
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
    </aside>
  )
}
