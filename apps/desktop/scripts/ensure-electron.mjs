/**
 * pnpm sometimes skips or cache-reuses Electron's install script (which
 * downloads the actual Electron binary), especially when the dependency
 * graph creates a second peer-variant instance of the electron package.
 * Without the binary, electron-vite dies with "Error: Electron uninstall".
 *
 * This runs before dev/dist and downloads the binary if it is missing.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const electronDir = dirname(require.resolve('electron/package.json'))

function binaryPresent() {
  try {
    const relative = readFileSync(join(electronDir, 'path.txt'), 'utf8').trim()
    return relative.length > 0 && existsSync(join(electronDir, 'dist', relative))
  } catch {
    return false
  }
}

if (!binaryPresent()) {
  console.log('Electron binary is missing, downloading it now…')
  execFileSync(process.execPath, [join(electronDir, 'install.js')], {
    cwd: electronDir,
    stdio: 'inherit'
  })
  if (!binaryPresent()) {
    console.error('Electron binary still missing after download. Try: pnpm rebuild electron')
    process.exit(1)
  }
  console.log('Electron binary installed.')
}
