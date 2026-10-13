import { readFile, readdir, rename, rm } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { sidecarPathFor, stashPathFor } from '@spec/core'
import type { OrphanSidecarInfo } from '../shared/ipc'
import { atomicWrite } from './files'

/**
 * Planning sidecar and stash file handling. The renderer owns the content
 * (JSON and Fountain text); this module only moves bytes, atomically, and
 * keeps the three files (script, sidecar, stash) traveling together.
 */

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

/** Atomic write; empty content removes the file (nothing worth keeping). */
export async function writePlanningFile(path: string, content: string): Promise<void> {
  if (content.length === 0) {
    await rm(path, { force: true })
    return
  }
  await atomicWrite(path, content)
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export interface RenameResult {
  newPath: string
  /** Files that moved along with the script. */
  moved: string[]
}

/**
 * Rename the script and its sidecar and stash together. If any step fails,
 * the already-done renames are rolled back so nothing is left half-renamed;
 * the error propagates to the caller either way.
 */
export async function renameScriptFiles(oldPath: string, newPath: string): Promise<RenameResult> {
  const pairs: Array<[string, string]> = [[oldPath, newPath]]
  if (await exists(sidecarPathFor(oldPath))) {
    pairs.push([sidecarPathFor(oldPath), sidecarPathFor(newPath)])
  }
  if (await exists(stashPathFor(oldPath))) {
    pairs.push([stashPathFor(oldPath), stashPathFor(newPath)])
  }

  // Refuse before touching anything if any target already exists
  for (const [, target] of pairs) {
    if (await exists(target)) {
      throw new Error(`A file named ${basename(target)} already exists there.`)
    }
  }

  const done: Array<[string, string]> = []
  for (const [from, to] of pairs) {
    try {
      await rename(from, to)
      done.push([from, to])
    } catch (err) {
      for (const [origFrom, origTo] of done.reverse()) {
        try {
          await rename(origTo, origFrom)
        } catch {
          // rollback is best effort; the original error matters more
        }
      }
      throw err
    }
  }
  return { newPath, moved: done.slice(1).map(([, to]) => to) }
}

export type OrphanSidecar = OrphanSidecarInfo

/**
 * Look for a sidecar in the script's folder whose own script file is gone.
 * Used when the opened script has no sidecar of its own: the writer probably
 * renamed the script outside the app.
 */
export async function findOrphanSidecar(scriptPath: string): Promise<OrphanSidecar | null> {
  const dir = dirname(scriptPath)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return null
  }
  const ownSidecar = basename(sidecarPathFor(scriptPath))

  for (const name of names.filter((n) => n.endsWith('.spec.json')).sort()) {
    if (name === ownSidecar) continue
    const base = name.slice(0, -'.spec.json'.length)
    const candidates = [`${base}.fountain`, `${base}.txt`]
    const scriptExists = await Promise.all(candidates.map((c) => exists(join(dir, c))))
    if (scriptExists.some(Boolean)) continue

    const stash = join(dir, `${base}.stash.fountain`)
    return {
      sidecarPath: join(dir, name),
      stashPath: (await exists(stash)) ? stash : null,
      missingScript: `${base}.fountain`
    }
  }
  return null
}

/** Rename an orphaned sidecar (and its stash) to belong to the open script. */
export async function attachOrphan(orphan: OrphanSidecar, scriptPath: string): Promise<void> {
  const sidecarTarget = sidecarPathFor(scriptPath)
  const stashTarget = stashPathFor(scriptPath)
  if (await exists(sidecarTarget)) {
    throw new Error(`${basename(sidecarTarget)} already exists.`)
  }
  if (orphan.stashPath && (await exists(stashTarget))) {
    throw new Error(`${basename(stashTarget)} already exists.`)
  }
  await rename(orphan.sidecarPath, sidecarTarget)
  if (orphan.stashPath) {
    try {
      await rename(orphan.stashPath, stashTarget)
    } catch (err) {
      await rename(sidecarTarget, orphan.sidecarPath) // roll back the pair
      throw err
    }
  }
}
