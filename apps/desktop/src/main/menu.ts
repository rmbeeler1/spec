import { BrowserWindow, Menu, app, shell, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'node:path'
import type { MenuCommand } from '../shared/ipc'

export interface MenuDeps {
  getRecents(): Promise<string[]>
  openRecent(window: BrowserWindow, path: string): Promise<void>
}

function send(command: MenuCommand): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('menu:command', command)
}

export async function buildMenu(deps: MenuDeps): Promise<void> {
  const isMac = process.platform === 'darwin'
  const recents = await deps.getRecents()

  const recentItems: MenuItemConstructorOptions[] =
    recents.length === 0
      ? [{ label: 'No Recent Files', enabled: false }]
      : recents.map((path) => ({
          label: basename(path),
          sublabel: path,
          click: (_item, win) => {
            if (win instanceof BrowserWindow) void deps.openRecent(win, path)
          }
        }))

  // Cmd+Ctrl+digit is unclaimed by macOS (Cmd+Alt+D is the Dock toggle and
  // Cmd+Shift+3/4/5 are screenshots); Ctrl+Shift+digit is unclaimed by
  // Windows and Linux, and avoids AltGr (Ctrl+Alt) layouts entirely. See
  // docs/shortcut-audit.md before adding any shortcut.
  const num = (n: number): string => (isMac ? `Cmd+Ctrl+${n}` : `Ctrl+Shift+${n}`)

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('file:new') },
        {
          label: 'New from Template',
          submenu: [
            { label: 'Feature Film', click: () => send('file:new-feature') },
            { label: 'TV Hour', click: () => send('file:new-tv-hour') },
            { label: 'TV Half-Hour', click: () => send('file:new-tv-half-hour') },
            { type: 'separator' },
            { label: 'Stage Play', click: () => send('file:new-stage-play') },
            { label: 'Audio Drama', click: () => send('file:new-audio-drama') },
            { label: 'Comic', click: () => send('file:new-comic') }
          ]
        },
        { type: 'separator' },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('file:open') },
        {
          label: 'Import…',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => send('file:import')
        },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file:save-as') },
        { label: 'Rename…', click: () => send('file:rename') },
        { type: 'separator' },
        { label: 'Title Page…', click: () => send('view:title-page') },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            { label: 'PDF…', accelerator: 'CmdOrCtrl+E', click: () => send('file:export-pdf') },
            { label: 'Final Draft (.fdx)…', click: () => send('file:export-fdx') },
            { label: 'Fountain…', click: () => send('file:export-fountain') }
          ]
        },
        { type: 'separator' },
        { label: 'Restore from Snapshot…', click: () => send('file:restore-snapshot') },
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find and Replace…', accelerator: 'CmdOrCtrl+F', click: () => send('edit:find') },
        {
          label: 'Send Selection to Stash',
          accelerator: 'CmdOrCtrl+Shift+X',
          click: () => send('edit:stash-selection')
        },
        {
          label: 'Toggle Dual Dialogue',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => send('edit:toggle-dual')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Write', accelerator: num(1), click: () => send('view:write') },
        {
          label: 'Corkboard',
          accelerator: num(2),
          click: () => send('view:corkboard')
        },
        { label: 'Pacing', accelerator: num(3), click: () => send('view:pacing') },
        {
          label: 'Beat Board',
          accelerator: num(4),
          click: () => send('view:beatboard')
        },
        { label: 'Outline', accelerator: num(5), click: () => send('view:outline') },
        { label: 'Reports', accelerator: num(6), click: () => send('view:reports') },
        {
          label: 'Toggle Stash',
          accelerator: num(7),
          click: () => send('view:toggle-stash')
        },
        { type: 'separator' },
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => send('view:toggle-dark')
        },
        {
          label: 'Toggle Focus Mode',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('view:toggle-focus')
        },
        {
          label: 'Show Structure',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => send('view:toggle-structure')
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ type: 'separator' as const }, { role: 'toggleDevTools' as const }])
      ]
    },
    {
      label: 'Production',
      submenu: [
        { label: 'Number Scenes', click: () => send('production:renumber') },
        {
          label: 'Lock Scene Numbers',
          click: () => send('production:toggle-number-lock')
        },
        {
          label: 'Lock / Unlock Pages',
          click: () => send('production:toggle-page-lock')
        },
        { type: 'separator' },
        { label: 'Revision Sets…', click: () => send('production:revisions') },
        { label: 'Omit Scene', click: () => send('production:omit-scene') },
        { label: 'Un-omit Scene', click: () => send('production:unomit-scene') },
        { type: 'separator' },
        { label: 'Writing Goal…', click: () => send('production:writing-goal') }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('help:shortcuts')
        },
        { label: 'Welcome Hint', click: () => send('help:welcome') },
        { type: 'separator' },
        {
          label: 'Spec on GitHub',
          click: () => void shell.openExternal('https://github.com/rmbeeler1/spec')
        },
        { type: 'separator' },
        { label: 'About Spec', click: () => send('help:about') }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
