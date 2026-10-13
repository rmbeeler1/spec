// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { importPdf } from './pdf'

/**
 * Regression guard for the "No GlobalWorkerOptions.workerSrc specified"
 * class of bug. pdf.js decides between its Node path and its browser/worker
 * path by probing the `process` global: plain unit tests always have one, so
 * they silently exercise the Node path and can never catch browser-only
 * failures. The Electron renderer is sandboxed and has no `process`, which
 * is exactly where the worker error appeared.
 *
 * This test runs importPdf with `process` hidden and a window present, so
 * pdf.js takes the same path it takes inside the renderer. It fails with the
 * workerSrc error if the main-thread worker registration ever regresses.
 *
 * The file is isolated: pdf.js must not have been imported earlier in this
 * module registry, because it samples `process` once at import time.
 */

const CORPUS = join(__dirname, '../../../../test-corpus')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('importPdf on the browser code path', () => {
  it('imports a corpus PDF without a configured worker, like the renderer', async () => {
    // Read the fixture while Node APIs still work
    const data = new Uint8Array(readFileSync(join(CORPUS, 'pdf/Brick And Steel.pdf')))

    // Now make the environment look like the sandboxed Electron renderer
    expect(typeof window).toBe('object')
    vi.stubGlobal('process', undefined)

    const { script, lines } = await importPdf(data)
    expect(lines.length).toBeGreaterThan(50)
    expect(script.elements.some((e) => e.type === 'scene_heading')).toBe(true)
  }, 60_000)
})
