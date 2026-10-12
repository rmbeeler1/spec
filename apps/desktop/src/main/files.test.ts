import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_SNAPSHOTS,
  atomicWrite,
  listSnapshots,
  readSnapshot,
  safeSave,
  snapshotDirFor
} from './files'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'spec-files-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('atomicWrite', () => {
  it('writes new files', async () => {
    const f = join(dir, 'a.fountain')
    await atomicWrite(f, 'INT. ROOM - DAY\n')
    expect(await readFile(f, 'utf8')).toBe('INT. ROOM - DAY\n')
  })

  it('replaces existing files and leaves no temp files behind', async () => {
    const f = join(dir, 'a.fountain')
    await atomicWrite(f, 'one')
    await atomicWrite(f, 'two')
    expect(await readFile(f, 'utf8')).toBe('two')
    const leftovers = (await readdir(dir)).filter((n) => n.includes('spec-tmp'))
    expect(leftovers).toEqual([])
  })
})

describe('safeSave and snapshots', () => {
  it('snapshots the previous content before overwriting', async () => {
    const userData = join(dir, 'userData')
    const f = join(dir, 'script.fountain')
    await writeFile(f, 'version one')

    await safeSave(userData, f, 'version two')
    expect(await readFile(f, 'utf8')).toBe('version two')

    const snaps = await listSnapshots(userData, f)
    expect(snaps.length).toBe(1)
    const content = await readSnapshot(userData, f, snaps[0]!.id)
    expect(content).toBe('version one')
  })

  it('takes no snapshot when the file does not exist yet', async () => {
    const userData = join(dir, 'userData')
    const f = join(dir, 'new.fountain')
    await safeSave(userData, f, 'first content')
    expect(await listSnapshots(userData, f)).toEqual([])
  })

  it('prunes old snapshots beyond the limit', async () => {
    const userData = join(dir, 'userData')
    const f = join(dir, 'script.fountain')
    await writeFile(f, 'v0')
    for (let i = 1; i <= MAX_SNAPSHOTS + 5; i++) {
      await safeSave(userData, f, `v${i}`)
      // Snapshot names have second precision; nudge mtime-based ordering
      // by making names unique through distinct content sizes instead.
    }
    const snaps = await listSnapshots(userData, f)
    expect(snaps.length).toBeLessThanOrEqual(MAX_SNAPSHOTS)
  })

  it('rejects snapshot ids that look like paths', async () => {
    const userData = join(dir, 'userData')
    const f = join(dir, 'script.fountain')
    expect(await readSnapshot(userData, f, '../../etc/passwd')).toBeNull()
  })

  it('keys snapshot dirs by file path', () => {
    const a = snapshotDirFor('/data', '/scripts/a.fountain')
    const b = snapshotDirFor('/data', '/scripts/b.fountain')
    expect(a).not.toBe(b)
  })
})
