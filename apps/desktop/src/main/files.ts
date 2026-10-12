import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Data safety rules, per the project plan:
 * - Writes are atomic: write to a temp file in the same directory, then
 *   rename over the target. A crash mid-write can never corrupt the script.
 * - Before overwriting, the previous file content is copied into a snapshot
 *   so there is always a way back.
 */

export const MAX_SNAPSHOTS = 25

/** Snapshots live under the app's userData dir, keyed by a hash of the path. */
export function snapshotDirFor(userDataDir: string, filePath: string): string {
  const key = createHash('sha256').update(filePath).digest('hex').slice(0, 16)
  return join(userDataDir, 'snapshots', key)
}

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = join(dirname(filePath), `.${randomUUID()}.spec-tmp`)
  await writeFile(tempPath, content, 'utf8')
  try {
    await rename(tempPath, filePath)
  } catch (err) {
    await rm(tempPath, { force: true })
    throw err
  }
}

/** Copy the file's current content into its snapshot dir, pruning old ones. */
export async function snapshotExisting(userDataDir: string, filePath: string): Promise<void> {
  try {
    await access(filePath, constants.F_OK)
  } catch {
    return // nothing to snapshot yet
  }
  const dir = snapshotDirFor(userDataDir, filePath)
  await mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await copyFile(filePath, join(dir, `${stamp}.fountain`))
  await pruneSnapshots(dir)
}

async function pruneSnapshots(dir: string): Promise<void> {
  const entries = (await readdir(dir)).filter((f) => f.endsWith('.fountain')).sort()
  const excess = entries.length - MAX_SNAPSHOTS
  for (let i = 0; i < excess; i++) {
    await rm(join(dir, entries[i]!), { force: true })
  }
}

export interface SnapshotEntry {
  id: string
  takenAt: number
  sizeBytes: number
}

export async function listSnapshots(
  userDataDir: string,
  filePath: string
): Promise<SnapshotEntry[]> {
  const dir = snapshotDirFor(userDataDir, filePath)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const out: SnapshotEntry[] = []
  for (const name of names.filter((f) => f.endsWith('.fountain')).sort().reverse()) {
    const s = await stat(join(dir, name))
    out.push({ id: name, takenAt: s.mtimeMs, sizeBytes: s.size })
  }
  return out
}

export async function readSnapshot(
  userDataDir: string,
  filePath: string,
  id: string
): Promise<string | null> {
  // The id must be a bare snapshot file name, never a path
  if (id.includes('/') || id.includes('\\') || id.includes('..')) return null
  try {
    return await readFile(join(snapshotDirFor(userDataDir, filePath), id), 'utf8')
  } catch {
    return null
  }
}

/** Save with snapshot-then-atomic-write. The order matters. */
export async function safeSave(
  userDataDir: string,
  filePath: string,
  content: string
): Promise<void> {
  await snapshotExisting(userDataDir, filePath)
  await atomicWrite(filePath, content)
}
