import { contextBridge, ipcRenderer } from 'electron'
import type { MenuCommand, OpenedFile, SpecApi } from '../shared/ipc'

const api: SpecApi = {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  openPath: (path) => ipcRenderer.invoke('file:open-path', path),
  importFile: () => ipcRenderer.invoke('dialog:import-file'),
  saveFileAs: (defaultName, filterName, extensions) =>
    ipcRenderer.invoke('dialog:save-file-as', defaultName, filterName, extensions),
  writeFile: (path, content) => ipcRenderer.invoke('file:write', path, content),
  writeBinaryFile: (path, data) => ipcRenderer.invoke('file:write-binary', path, data),
  listSnapshots: (path) => ipcRenderer.invoke('snapshots:list', path),
  readSnapshot: (path, id) => ipcRenderer.invoke('snapshots:read', path, id),
  setDocumentState: (filePath, dirty) => ipcRenderer.send('doc:state', filePath, dirty),
  readTextFile: (path) => ipcRenderer.invoke('planning:read', path),
  writePlanningFile: (path, content) => ipcRenderer.invoke('planning:write', path, content),
  renameScript: (oldPath, newName) => ipcRenderer.invoke('file:rename', oldPath, newName),
  findOrphanSidecar: (scriptPath) => ipcRenderer.invoke('planning:find-orphan', scriptPath),
  attachOrphanSidecar: (orphan, scriptPath) =>
    ipcRenderer.invoke('planning:attach-orphan', orphan, scriptPath),
  getRecentFiles: () => ipcRenderer.invoke('recents:get'),
  onMenuCommand: (handler) => {
    const listener = (_event: unknown, command: MenuCommand): void => handler(command)
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  },
  onFileOpened: (handler) => {
    const listener = (_event: unknown, file: OpenedFile): void => handler(file)
    ipcRenderer.on('file:opened', listener)
    return () => ipcRenderer.removeListener('file:opened', listener)
  }
}

contextBridge.exposeInMainWorld('spec', api)
