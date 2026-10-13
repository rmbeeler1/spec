import type { OrphanSidecarInfo } from '../../../shared/ipc'

interface Props {
  orphan: OrphanSidecarInfo
  scriptName: string
  onAttach(): void
  onDecline(): void
}

/**
 * Shown when the opened script has no planning sidecar, but the folder holds
 * one whose script file is gone (renamed outside the app, most likely).
 */
export function OrphanPrompt({ orphan, scriptName, onAttach, onDecline }: Props): React.JSX.Element {
  const sidecarName = orphan.sidecarPath.split(/[/\\]/).pop()
  return (
    <div className="dialog-backdrop" onClick={onDecline}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Found planning data without a script</h2>
        <p className="hint">
          <strong>{sidecarName}</strong> holds cards, colors{orphan.stashPath ? ', stash material' : ''} and
          other planning data for <strong>{orphan.missingScript}</strong>, but that script is not
          here any more. If you renamed it to <strong>{scriptName}</strong> outside the app, attach
          the planning data and everything comes back.
        </p>
        <div className="dialog-buttons">
          <button onClick={onDecline}>Leave it</button>
          <button className="primary" onClick={onAttach}>
            Attach to {scriptName}
          </button>
        </div>
      </div>
    </div>
  )
}
