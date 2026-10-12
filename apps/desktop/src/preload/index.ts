import { contextBridge } from 'electron'

// The only bridge between the UI and the system. Everything the renderer
// needs from Electron gets exposed here, explicitly, one key at a time.
contextBridge.exposeInMainWorld('spec', {
  platform: process.platform
})
