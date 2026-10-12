import type { ElementType, Script, ScriptElement, TitlePageEntry } from '@spec/core'
import { randomIdGenerator } from '@spec/core'

/**
 * Convert between the core Script model and the editor's ProseMirror
 * document JSON. Multi-line element text maps to lineBreak nodes.
 */

export interface PmInline {
  type: 'text' | 'lineBreak'
  text?: string
}

export interface PmElement {
  type: 'element'
  attrs: {
    type: ElementType
    elementId: string | null
    sceneNumber: string | null
    dual: boolean
    depth: number | null
  }
  content?: PmInline[]
}

export interface PmDoc {
  type: 'doc'
  content: PmElement[]
}

export function scriptToDoc(script: Script): PmDoc {
  const content: PmElement[] = script.elements.map((el) => ({
    type: 'element',
    attrs: {
      type: el.type,
      elementId: el.id,
      sceneNumber: el.sceneNumber ?? null,
      dual: el.dual ?? false,
      depth: el.depth ?? null
    },
    content: textToInline(el.text)
  }))
  if (content.length === 0) {
    content.push({
      type: 'element',
      attrs: { type: 'scene_heading', elementId: null, sceneNumber: null, dual: false, depth: null }
    })
  }
  return { type: 'doc', content }
}

function textToInline(text: string): PmInline[] | undefined {
  if (text.length === 0) return undefined
  const out: PmInline[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out.push({ type: 'lineBreak' })
    if (lines[i]!.length > 0) out.push({ type: 'text', text: lines[i]! })
  }
  return out.length > 0 ? out : undefined
}

export function docToScript(doc: PmDoc, titlePage: TitlePageEntry[]): Script {
  const nextId = randomIdGenerator()
  const seen = new Set<string>()
  const elements: ScriptElement[] = []

  for (const node of doc.content ?? []) {
    if (node.type !== 'element') continue
    const attrs = node.attrs
    let id = attrs.elementId ?? ''
    // Splitting a block copies its attributes; give duplicates fresh IDs so
    // planning data in project.json can never point at two elements at once.
    if (id === '' || seen.has(id)) id = nextId()
    seen.add(id)

    const text = inlineToText(node.content)
    // Skip trailing empty action blocks the writer left behind
    const el: ScriptElement = { id, type: attrs.type, text }
    if (attrs.sceneNumber) el.sceneNumber = attrs.sceneNumber
    if (attrs.dual) el.dual = true
    if (attrs.depth != null && attrs.type === 'section') el.depth = attrs.depth
    elements.push(el)
  }

  // Drop empty elements: they are editing artifacts, not script content.
  // Page breaks are the exception since they are empty by nature.
  const cleaned = elements.filter((e) => e.type === 'page_break' || e.text.trim().length > 0)

  return { titlePage, elements: cleaned }
}

function inlineToText(content: PmInline[] | undefined): string {
  if (!content) return ''
  let out = ''
  for (const node of content) {
    if (node.type === 'lineBreak') out += '\n'
    else out += node.text ?? ''
  }
  return out
}
