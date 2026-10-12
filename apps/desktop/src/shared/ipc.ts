/**
 * The typed contract between main and renderer. The preload script exposes
 * exactly this surface as window.spec.
 */

export interface OpenedFile {
  path: string
  content: string
}

export interface SnapshotInfo {
  /** Snapshot file name, also its id. */
  id: string
  /** Milliseconds since epoch when the snapshot was written. */
  takenAt: number
  sizeBytes: number
}

/** Sent from the native menu to the renderer. */
export type MenuCommand =
  | 'file:new'
  | 'file:new-feature'
  | 'file:new-tv-hour'
  | 'file:new-tv-half-hour'
  | 'file:open'
  | 'file:save'
  | 'file:save-as'
  | 'file:export-pdf'
  | 'file:export-fdx'
  | 'file:export-fountain'
  | 'file:restore-snapshot'
  | 'edit:find'
  | 'view:toggle-dark'
  | 'view:toggle-focus'
  | 'view:title-page'
  | 'help:shortcuts'
  | 'help:welcome'

export interface SpecApi {
  platform: string
  /** Show an open dialog and read the chosen file. */
  openFile(): Promise<OpenedFile | null>
  /** Open a specific path (recent files). */
  openPath(path: string): Promise<OpenedFile | null>
  /** Show a save dialog. Returns the chosen path or null. */
  saveFileAs(defaultName: string, filterName: string, extensions: string[]): Promise<string | null>
  /** Atomic write. Also snapshots the previous content of the file. */
  writeFile(path: string, content: string): Promise<void>
  /** Write binary data (PDF export). */
  writeBinaryFile(path: string, data: Uint8Array): Promise<void>
  listSnapshots(path: string): Promise<SnapshotInfo[]>
  readSnapshot(path: string, id: string): Promise<string | null>
  /** Tell main the current document state for the window title and close guard. */
  setDocumentState(filePath: string | null, dirty: boolean): void
  getRecentFiles(): Promise<string[]>
  onMenuCommand(handler: (command: MenuCommand) => void): void
  /** Open-recent clicks arrive as opened files, same shape as openFile(). */
  onFileOpened(handler: (file: OpenedFile) => void): void
}
