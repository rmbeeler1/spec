import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const MAX_RECENTS = 10

export function recentsPathFor(userDataDir: string): string {
  return join(userDataDir, 'recent-files.json')
}

export async function getRecents(userDataDir: string): Promise<string[]> {
  try {
    const raw = await readFile(recentsPathFor(userDataDir), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((p): p is string => typeof p === 'string')
  } catch {
    // first run, or corrupt file: start fresh
  }
  return []
}

export async function addRecent(userDataDir: string, filePath: string): Promise<string[]> {
  const list = await getRecents(userDataDir)
  const next = [filePath, ...list.filter((p) => p !== filePath)].slice(0, MAX_RECENTS)
  const target = recentsPathFor(userDataDir)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/** After an in-app rename, the old path in recents becomes the new one. */
export async function replaceRecent(
  userDataDir: string,
  oldPath: string,
  newPath: string
): Promise<string[]> {
  const list = await getRecents(userDataDir)
  const next = list.map((p) => (p === oldPath ? newPath : p))
  const target = recentsPathFor(userDataDir)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(next, null, 2), 'utf8')
  return next
}
