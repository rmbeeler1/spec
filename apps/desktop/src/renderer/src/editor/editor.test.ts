import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { parseFountain, sequentialIdGenerator, serializeFountain } from '@spec/core'
import { LineBreak, ScreenplayDocument, ScreenplayElement, ScreenplayText } from './schema'
import { docToScript, scriptToDoc, type PmDoc } from './convert'
import {
  baseCharacterName,
  cycleType,
  detectTypeOnEnter,
  needsContd,
  nextTypeOnEnter,
  normalizeSceneHeading,
  withContd
} from './keymapLogic'

const CORPUS = join(__dirname, '../../../../../../test-corpus/fountain')

const schema = getSchema([ScreenplayDocument, ScreenplayText, LineBreak, ScreenplayElement])

function corpusFiles(): Array<{ name: string; path: string }> {
  const out: Array<{ name: string; path: string }> = []
  for (const dir of ['spec-samples', 'spec-fixtures', 'scripts']) {
    for (const f of readdirSync(join(CORPUS, dir)).filter((f) => f.endsWith('.fountain'))) {
      out.push({ name: `${dir}/${f}`, path: join(CORPUS, dir, f) })
    }
  }
  return out
}

describe('script <-> editor document round-trip on the corpus', () => {
  for (const { name, path } of corpusFiles()) {
    it(`round-trips ${name}`, () => {
      const script = parseFountain(readFileSync(path, 'utf8'), {
        idGenerator: sequentialIdGenerator()
      })
      const doc = scriptToDoc(script)

      // The generated JSON must satisfy the real ProseMirror schema
      const pmNode = schema.nodeFromJSON(doc)
      pmNode.check()

      const back = docToScript(pmNode.toJSON() as PmDoc, script.titlePage)
      const strip = (s: typeof script) =>
        s.elements
          .filter((e) => e.type === 'page_break' || e.text.trim().length > 0)
          .map((e) => ({
            id: e.id,
            type: e.type,
            text: e.text,
            sceneNumber: e.sceneNumber,
            dual: e.dual
          }))
      expect(strip(back)).toEqual(strip(script))

      // And the whole chain back to Fountain still parses identically
      const reparsed = parseFountain(serializeFountain(back), {
        idGenerator: sequentialIdGenerator()
      })
      expect(reparsed.elements.map((e) => e.type)).toEqual(
        parseFountain(serializeFountain(script), { idGenerator: sequentialIdGenerator() }).elements.map(
          (e) => e.type
        )
      )
    })
  }
})

describe('docToScript id handling', () => {
  it('gives duplicated ids fresh values', () => {
    const doc: PmDoc = {
      type: 'doc',
      content: [
        {
          type: 'element',
          attrs: { type: 'action', elementId: 'dup', sceneNumber: null, dual: false, depth: null },
          content: [{ type: 'text', text: 'one' }]
        },
        {
          type: 'element',
          attrs: { type: 'action', elementId: 'dup', sceneNumber: null, dual: false, depth: null },
          content: [{ type: 'text', text: 'two' }]
        }
      ]
    }
    const script = docToScript(doc, [])
    expect(script.elements.length).toBe(2)
    expect(script.elements[0]!.id).toBe('dup')
    expect(script.elements[1]!.id).not.toBe('dup')
  })
})

describe('keyboard model', () => {
  it('follows the standard flow on Enter', () => {
    expect(nextTypeOnEnter('scene_heading')).toBe('action')
    expect(nextTypeOnEnter('character')).toBe('dialogue')
    expect(nextTypeOnEnter('parenthetical')).toBe('dialogue')
    expect(nextTypeOnEnter('dialogue')).toBe('character')
    expect(nextTypeOnEnter('transition')).toBe('scene_heading')
  })

  it('cycles types with Tab in both directions', () => {
    expect(cycleType('action')).toBe('character')
    expect(cycleType('action', true)).toBe('scene_heading')
    expect(cycleType('transition')).toBe('scene_heading')
  })

  it('detects scene headings, transitions, cues and parentheticals', () => {
    expect(detectTypeOnEnter('INT. KITCHEN - DAY', 'action')).toBe('scene_heading')
    expect(detectTypeOnEnter('int. kitchen - day', 'action')).toBe('scene_heading')
    expect(detectTypeOnEnter('SMASH CUT TO:', 'action')).toBe('transition')
    expect(detectTypeOnEnter('MARGO', 'action')).toBe('character')
    expect(detectTypeOnEnter('(beat)', 'dialogue')).toBe('parenthetical')
  })

  it('normalizes scene heading prefixes', () => {
    expect(normalizeSceneHeading('int house - day')).toBe('INT. house - day')
    expect(normalizeSceneHeading('INT HOUSE - DAY')).toBe('INT. HOUSE - DAY')
    expect(normalizeSceneHeading('ext. CLIFF - DAWN')).toBe('EXT. CLIFF - DAWN')
    expect(normalizeSceneHeading('int/ext car - night')).toBe('INT./EXT. car - night')
    expect(normalizeSceneHeading('INT./EXT. CAR - NIGHT')).toBe('INT./EXT. CAR - NIGHT')
    expect(normalizeSceneHeading('i/e car - night')).toBe('I/E. car - night')
    expect(normalizeSceneHeading('est city - day')).toBe('EST. city - day')
    expect(normalizeSceneHeading('Not a heading at all')).toBe('Not a heading at all')
  })

  it('compares character names ignoring extensions and dual carets', () => {
    expect(baseCharacterName("EDWARD (V.O.) ^")).toBe('EDWARD')
    expect(baseCharacterName("edward (CONT'D)")).toBe('EDWARD')
    expect(baseCharacterName('MARGO')).toBe('MARGO')
  })

  it("adds (CONT'D) when the same character speaks after action", () => {
    const prev = [
      { type: 'character' as const, text: 'EDWARD' },
      { type: 'dialogue' as const, text: 'First speech.' },
      { type: 'action' as const, text: 'He points at the river.' }
    ]
    expect(needsContd(prev, 'EDWARD')).toBe(true)
    expect(needsContd(prev, 'EDWARD (V.O.)')).toBe(true)
    expect(needsContd(prev, 'WILL')).toBe(false)
    expect(needsContd(prev, "EDWARD (CONT'D)")).toBe(false) // already marked
  })

  it("does not add (CONT'D) across scene boundaries or without interruption", () => {
    const acrossScene = [
      { type: 'character' as const, text: 'EDWARD' },
      { type: 'dialogue' as const, text: 'Speech.' },
      { type: 'scene_heading' as const, text: 'INT. HALL - DAY' },
      { type: 'action' as const, text: 'Later.' }
    ]
    expect(needsContd(acrossScene, 'EDWARD')).toBe(false)

    const noInterruption = [
      { type: 'character' as const, text: 'EDWARD' },
      { type: 'dialogue' as const, text: 'Speech.' }
    ]
    expect(needsContd(noInterruption, 'EDWARD')).toBe(false)
  })

  it("appends (CONT'D) keeping dual carets", () => {
    expect(withContd('EDWARD')).toBe("EDWARD (CONT'D)")
    expect(withContd('EDWARD ^')).toBe("EDWARD (CONT'D) ^")
  })

  it('leaves ordinary action and manual choices alone', () => {
    expect(detectTypeOnEnter('She walks away.', 'action')).toBe('action')
    expect(detectTypeOnEnter('BANG. THE DOOR EXPLODES INWARD, SPLINTERS EVERYWHERE.', 'action')).toBe(
      'action'
    )
    expect(detectTypeOnEnter('MARGO', 'dialogue')).toBe('dialogue')
  })
})
