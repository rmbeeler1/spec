import { XMLParser } from 'fast-xml-parser'
import type { ElementType, Script, ScriptElement } from '../model/types'
import { randomIdGenerator, type IdGenerator } from '../model/ids'

export interface ReadFdxOptions {
  idGenerator?: IdGenerator
}

const TYPE_MAP: Record<string, ElementType> = {
  'scene heading': 'scene_heading',
  action: 'action',
  general: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
  shot: 'shot',
  lyrics: 'lyric',
  'cast list': 'action',
  singing: 'lyric'
}

/**
 * Read a Final Draft FDX file into the document model. The FDX title page is
 * free-form text, so it is not mapped back to Fountain title page keys.
 */
export function readFdx(xml: string, options: ReadFdxOptions = {}): Script {
  const nextId = options.idGenerator ?? randomIdGenerator()
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: true,
    trimValues: false
  })
  const doc = parser.parse(xml) as OrderedNode[]

  const finalDraft = findChild(doc, 'FinalDraft')
  if (!finalDraft) throw new Error('Not an FDX file: missing FinalDraft root element')
  const content = findChild(children(finalDraft), 'Content')
  if (!content) throw new Error('Not an FDX file: missing Content element')

  const elements: ScriptElement[] = []
  const push = (el: Omit<ScriptElement, 'id'>): void => {
    elements.push({ id: nextId(), ...el })
  }

  for (const node of children(content)) {
    const name = nodeName(node)
    if (name === 'Paragraph') {
      readParagraph(node, push, false)
    } else if (name === 'DualDialogue') {
      let seenCharacters = 0
      for (const inner of children(node)) {
        if (nodeName(inner) === 'Paragraph') {
          const isCharacter = attr(inner, 'Type')?.toLowerCase() === 'character'
          if (isCharacter) seenCharacters++
          readParagraph(inner, push, isCharacter && seenCharacters === 2)
        }
      }
    }
  }

  return { titlePage: [], elements }
}

interface OrderedNode {
  [key: string]: unknown
  ':@'?: Record<string, string>
}

function nodeName(node: OrderedNode): string {
  return Object.keys(node).find((k) => k !== ':@') ?? ''
}

function children(node: OrderedNode): OrderedNode[] {
  const name = nodeName(node)
  const value = node[name]
  return Array.isArray(value) ? (value as OrderedNode[]) : []
}

function findChild(nodes: OrderedNode[], name: string): OrderedNode | undefined {
  return nodes.find((n) => nodeName(n) === name)
}

function attr(node: OrderedNode, name: string): string | undefined {
  return node[':@']?.[`@_${name}`]
}

function readParagraph(
  node: OrderedNode,
  push: (el: Omit<ScriptElement, 'id'>) => void,
  dual: boolean
): void {
  const fdxType = (attr(node, 'Type') ?? 'Action').toLowerCase()
  let type: ElementType = TYPE_MAP[fdxType] ?? 'action'
  if (type === 'action' && attr(node, 'Alignment') === 'Center') type = 'centered'

  const text = readRuns(node)
  if (text.trim().length === 0) return

  const el: Omit<ScriptElement, 'id'> = { type, text: text.trim() }
  const sceneNumber = attr(node, 'Number')
  if (type === 'scene_heading' && sceneNumber) el.sceneNumber = sceneNumber
  if (type === 'character' && dual) el.dual = true
  push(el)
}

/** Concatenate <Text> runs, converting FDX styles to Fountain markers. */
function readRuns(paragraphNode: OrderedNode): string {
  let out = ''
  for (const child of children(paragraphNode)) {
    if (nodeName(child) !== 'Text') continue
    const style = (attr(child, 'Style') ?? '').toLowerCase()
    let run = ''
    for (const textChild of children(child)) {
      const t = textChild['#text']
      if (t !== undefined) run += String(t)
    }
    if (run.length === 0) continue
    const core = run
    const trimmed = core.trim()
    if (trimmed.length > 0 && style) {
      // Apply markers around the trimmed middle, keeping outer whitespace
      const leading = core.slice(0, core.indexOf(trimmed))
      const trailing = core.slice(core.indexOf(trimmed) + trimmed.length)
      let marked = trimmed
      if (style.includes('underline')) marked = `_${marked}_`
      if (style.includes('bold') && style.includes('italic')) marked = `***${marked}***`
      else if (style.includes('bold')) marked = `**${marked}**`
      else if (style.includes('italic')) marked = `*${marked}*`
      run = leading + marked + trailing
    }
    out += run
  }
  return out
}
