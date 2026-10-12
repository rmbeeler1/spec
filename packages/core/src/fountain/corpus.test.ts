import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFountain } from './parse'
import { serializeFountain } from './serialize'
import { sequentialIdGenerator } from '../model/ids'

const CORPUS = join(__dirname, '../../../../test-corpus/fountain')

interface CorpusFile {
  name: string // platform-independent, used in test and snapshot names
  path: string
}

function corpusFiles(dir: string): CorpusFile[] {
  return readdirSync(join(CORPUS, dir))
    .filter((f) => f.endsWith('.fountain'))
    .map((f) => ({ name: `${dir}/${f}`, path: join(CORPUS, dir, f) }))
}

const allFiles = [
  ...corpusFiles('spec-samples'),
  ...corpusFiles('spec-fixtures'),
  ...corpusFiles('scripts')
]

describe('parseFountain on the corpus', () => {
  for (const { name, path: file } of allFiles) {
    it(`parses ${name}`, () => {
      const source = readFileSync(file, 'utf8')
      const script = parseFountain(source, { idGenerator: sequentialIdGenerator() })
      // Structure snapshot: type plus first 60 chars of each element
      const shape = script.elements.map((e) => {
        const head = e.text.replace(/\n/g, '\\n').slice(0, 60)
        const marks = [
          e.sceneNumber ? `#${e.sceneNumber}#` : '',
          e.dual ? '^' : '',
          e.forced ? '!' : '',
          e.depth ? `d${e.depth}` : ''
        ]
          .filter(Boolean)
          .join(' ')
        return `${e.type}${marks ? ` [${marks}]` : ''}: ${head}`
      })
      expect({ titlePage: script.titlePage, shape }).toMatchSnapshot()
    })
  }
})

describe('round-trip: parse -> serialize -> parse', () => {
  for (const { name, path: file } of allFiles) {
    it(`round-trips ${name}`, () => {
      const source = readFileSync(file, 'utf8')
      const first = parseFountain(source, { idGenerator: sequentialIdGenerator() })
      const serialized = serializeFountain(first)
      const second = parseFountain(serialized, { idGenerator: sequentialIdGenerator() })

      const strip = (s: typeof first) =>
        s.elements.map((e) => ({
          type: e.type,
          text: e.text,
          sceneNumber: e.sceneNumber,
          dual: e.dual,
          depth: e.depth
        }))
      expect(strip(second)).toEqual(strip(first))
      expect(second.titlePage).toEqual(first.titlePage)
    })
  }
})
