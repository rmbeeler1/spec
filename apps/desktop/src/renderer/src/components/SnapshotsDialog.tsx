import { useEffect, useState } from 'react'
import type { SnapshotInfo } from '../../../shared/ipc'

interface Props {
  filePath: string
  onRestore(content: string): void
  onClose(): void
}

export function SnapshotsDialog({ filePath, onRestore, onClose }: Props): React.JSX.Element {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | null>(null)

  useEffect(() => {
    void window.spec.listSnapshots(filePath).then(setSnapshots)
  }, [filePath])

  const restore = async (id: string): Promise<void> => {
    const content = await window.spec.readSnapshot(filePath, id)
    if (content !== null) {
      onRestore(content)
      onClose()
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Restore from Snapshot</h2>
        <p className="hint">
          A snapshot is taken automatically every time the file is saved. Restoring replaces the
          current editor content (the file itself is not touched until the next save).
        </p>
        {snapshots === null && <p>Loading…</p>}
        {snapshots?.length === 0 && <p className="empty">No snapshots yet for this file.</p>}
        <ul className="snapshot-list">
          {snapshots?.map((s) => (
            <li key={s.id}>
              <span>
                {new Date(s.takenAt).toLocaleString()} · {(s.sizeBytes / 1024).toFixed(1)} KB
              </span>
              <button onClick={() => void restore(s.id)}>Restore</button>
            </li>
          ))}
        </ul>
        <div className="dialog-buttons">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
