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
  | 'file:import'
  | 'file:save'
  | 'file:save-as'
  | 'file:rename'
  | 'file:export-pdf'
  | 'file:export-fdx'
  | 'file:export-fountain'
  | 'file:restore-snapshot'
  | 'edit:find'
  | 'edit:stash-selection'
  | 'edit:toggle-dual'
  | 'view:toggle-dark'
  | 'view:toggle-focus'
  | 'view:toggle-structure'
  | 'view:toggle-stash'
  | 'view:title-page'
  | 'view:write'
  | 'view:corkboard'
  | 'view:pacing'
  | 'view:beatboard'
  | 'view:outline'
  | 'view:reports'
  | 'production:renumber'
  | 'production:toggle-number-lock'
  | 'production:writing-goal'
  | 'help:shortcuts'
  | 'help:welcome'
  | 'help:about'

/** A planning sidecar in the script's folder whose own script file is gone. */
export interface OrphanSidecarInfo {
  sidecarPath: string
  stashPath: string | null
  /** Name of the script file the orphan belonged to, for the prompt text. */
  missingScript: string
}

export type RenameOutcome = { newPath: string } | { error: string }

export interface SpecApi {
  platform: string
  /** App version from package.json, for the About dialog. */
  getAppVersion(): Promise<string>
  /** Show an open dialog and read the chosen file. */
  openFile(): Promise<OpenedFile | null>
  /** Open a specific path (recent files). */
  openPath(path: string): Promise<OpenedFile | null>
  /** Show an import dialog and read the chosen file as bytes. */
  importFile(): Promise<{ path: string; data: Uint8Array } | null>
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
  /** Read a text file, null when it does not exist (sidecar, stash). */
  readTextFile(path: string): Promise<string | null>
  /** Atomic write for planning files; empty content removes the file. */
  writePlanningFile(path: string, content: string): Promise<void>
  /** Rename the script plus its sidecar and stash. newName is a file name. */
  renameScript(oldPath: string, newName: string): Promise<RenameOutcome>
  findOrphanSidecar(scriptPath: string): Promise<OrphanSidecarInfo | null>
  /** Returns an error message, or null on success. */
  attachOrphanSidecar(orphan: OrphanSidecarInfo, scriptPath: string): Promise<string | null>
  getRecentFiles(): Promise<string[]>
  onMenuCommand(handler: (command: MenuCommand) => void): void
  /** Open-recent clicks arrive as opened files, same shape as openFile(). */
  onFileOpened(handler: (file: OpenedFile) => void): void
}
