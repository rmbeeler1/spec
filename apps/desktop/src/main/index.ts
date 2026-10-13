import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { OpenedFile, OrphanSidecarInfo } from '../shared/ipc'
import { listSnapshots, readSnapshot, safeSave } from './files'
import {
  attachOrphan,
  findOrphanSidecar,
  readTextIfExists,
  renameScriptFiles,
  writePlanningFile
} from './planning'
import { addRecent, getRecents, replaceRecent } from './recents'
import { buildMenu } from './menu'

interface DocumentState {
  filePath: string | null
  dirty: boolean
}

const docState: DocumentState = { filePath: null, dirty: false }

const FOUNTAIN_FILTERS = [
  { name: 'Fountain', extensions: ['fountain', 'txt'] },
  { name: 'Final Draft', extensions: ['fdx'] }
]

function updateTitle(win: BrowserWindow): void {
  const name = docState.filePath ? basename(docState.filePath) : 'Untitled'
  win.setTitle(`${docState.dirty ? '• ' : ''}${name} - Spec`)
  win.setDocumentEdited(docState.dirty)
  if (docState.filePath) win.setRepresentedFilename(docState.filePath)
}

async function openPath(win: BrowserWindow, path: string): Promise<OpenedFile | null> {
  try {
    const content = await readFile(path, 'utf8')
    await addRecent(app.getPath('userData'), path)
    await buildMenu(menuDeps)
    return { path, content }
  } catch (err) {
    dialog.showErrorBox('Could not open file', err instanceof Error ? err.message : String(err))
    return null
  }
}

const menuDeps = {
  getRecents: () => getRecents(app.getPath('userData')),
  openRecent: async (win: BrowserWindow, path: string): Promise<void> => {
    const opened = await openPath(win, path)
    if (opened) win.webContents.send('file:opened', opened)
  }
}

function registerIpc(): void {
  ipcMain.handle('dialog:open-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: FOUNTAIN_FILTERS
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    return openPath(win, path)
  })

  ipcMain.handle('dialog:import-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Importable scripts', extensions: ['fountain', 'fdx', 'docx', 'pdf', 'txt', 'md'] }
      ]
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    try {
      const data = await readFile(path)
      return { path, data }
    } catch (err) {
      dialog.showErrorBox('Could not import file', err instanceof Error ? err.message : String(err))
      return null
    }
  })

  ipcMain.handle('file:open-path', async (event, path: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || typeof path !== 'string') return null
    return openPath(win, path)
  })

  ipcMain.handle(
    'dialog:save-file-as',
    async (event, defaultName: unknown, filterName: unknown, extensions: unknown) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return null
      const result = await dialog.showSaveDialog(win, {
        defaultPath: typeof defaultName === 'string' ? defaultName : 'Untitled.fountain',
        filters: [
          {
            name: typeof filterName === 'string' ? filterName : 'Fountain',
            extensions: Array.isArray(extensions) ? (extensions as string[]) : ['fountain']
          }
        ]
      })
      return result.canceled || !result.filePath ? null : result.filePath
    }
  )

  ipcMain.handle('file:write', async (_event, path: unknown, content: unknown) => {
    if (typeof path !== 'string' || typeof content !== 'string') {
      throw new Error('Bad write request')
    }
    await safeSave(app.getPath('userData'), path, content)
    await addRecent(app.getPath('userData'), path)
    await buildMenu(menuDeps)
  })

  ipcMain.handle('file:write-binary', async (_event, path: unknown, data: unknown) => {
    if (typeof path !== 'string' || !(data instanceof Uint8Array)) {
      throw new Error('Bad binary write request')
    }
    await writeFile(path, data)
  })

  ipcMain.handle('snapshots:list', (_event, path: unknown) =>
    typeof path === 'string' ? listSnapshots(app.getPath('userData'), path) : []
  )

  ipcMain.handle('snapshots:read', (_event, path: unknown, id: unknown) =>
    typeof path === 'string' && typeof id === 'string'
      ? readSnapshot(app.getPath('userData'), path, id)
      : null
  )

  ipcMain.handle('recents:get', () => getRecents(app.getPath('userData')))

  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('planning:read', (_event, path: unknown) =>
    typeof path === 'string' ? readTextIfExists(path) : null
  )

  ipcMain.handle('planning:write', async (_event, path: unknown, content: unknown) => {
    if (typeof path !== 'string' || typeof content !== 'string') {
      throw new Error('Bad planning write request')
    }
    await writePlanningFile(path, content)
  })

  ipcMain.handle('file:rename', async (event, oldPath: unknown, newName: unknown) => {
    if (typeof oldPath !== 'string' || typeof newName !== 'string') {
      return { error: 'Bad rename request' }
    }
    // The new name stays in the script's folder; strip any path separators
    const clean = newName.replace(/[/\\]/g, '').trim()
    if (clean.length === 0) return { error: 'The new name is empty.' }
    const withExt = /\.(fountain|txt)$/i.test(clean) ? clean : `${clean}.fountain`
    const newPath = join(dirname(oldPath), withExt)
    if (newPath === oldPath) return { newPath }
    try {
      const result = await renameScriptFiles(oldPath, newPath)
      await replaceRecent(app.getPath('userData'), oldPath, result.newPath)
      await buildMenu(menuDeps)
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && docState.filePath === oldPath) {
        docState.filePath = result.newPath
        updateTitle(win)
      }
      return { newPath: result.newPath }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('planning:find-orphan', (_event, scriptPath: unknown) =>
    typeof scriptPath === 'string' ? findOrphanSidecar(scriptPath) : null
  )

  ipcMain.handle('planning:attach-orphan', async (_event, orphan: unknown, scriptPath: unknown) => {
    if (typeof scriptPath !== 'string' || typeof orphan !== 'object' || orphan === null) {
      return 'Bad attach request'
    }
    try {
      await attachOrphan(orphan as OrphanSidecarInfo, scriptPath)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  })

  ipcMain.on('doc:state', (event, filePath: unknown, dirty: unknown) => {
    docState.filePath = typeof filePath === 'string' ? filePath : null
    docState.dirty = dirty === true
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) updateTitle(win)
  })
}

// In a packaged app the exe/bundle carries the icon; dev and Linux windows
// take it from the generated set.
const windowIcon = app.isPackaged
  ? undefined
  : join(__dirname, '../../build/icons/512x512.png')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 480,
    show: false,
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => win.show())
  updateTitle(win)

  // Close guard: autosave covers saved files; warn when an unsaved document
  // would be lost.
  win.on('close', (event) => {
    if (!docState.dirty) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Discard Changes', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'This document has unsaved changes.',
      detail: 'Saved files are autosaved continuously. Unsaved changes here will be lost.'
    })
    if (choice === 1) event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  app.setAboutPanelOptions({
    applicationName: 'Spec',
    applicationVersion: app.getVersion(),
    copyright: 'MIT licensed, free and open source'
  })
  // Dev runs are not packaged, so give the Dock the real icon by hand
  if (process.platform === 'darwin' && !app.isPackaged && windowIcon) {
    app.dock?.setIcon(windowIcon)
  }
  registerIpc()
  await buildMenu(menuDeps)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
