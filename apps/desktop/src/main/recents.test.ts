import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addRecent, getRecents, replaceRecent } from './recents'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'spec-recents-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('replaceRecent', () => {
  it('swaps the renamed path in place, keeping order', async () => {
    await addRecent(dir, '/a/Old.fountain')
    await addRecent(dir, '/a/Other.fountain')
    await replaceRecent(dir, '/a/Old.fountain', '/a/New.fountain')
    expect(await getRecents(dir)).toEqual(['/a/Other.fountain', '/a/New.fountain'])
  })

  it('does nothing when the old path is not listed', async () => {
    await addRecent(dir, '/a/Other.fountain')
    await replaceRecent(dir, '/a/Missing.fountain', '/a/New.fountain')
    expect(await getRecents(dir)).toEqual(['/a/Other.fountain'])
  })
})
