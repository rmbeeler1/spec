import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'
import type { IdGenerator } from '../model/ids'
import { classifyLines, type ImportLine } from './classifier'
import { buildScript, extractTitlePage } from './build'
import type { ImportResult } from './text'

/**
 * Import a Word document. The docx is a zip; word/document.xml holds one
 * w:p (paragraph) per line with runs of text plus the layout hints the
 * classifier wants: centered alignment, left indent, bold.
 */
export function importDocx(data: Uint8Array, options: { idGenerator?: IdGenerator } = {}): ImportResult {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new Error('Not a .docx file (could not read it as a zip archive)')
  }
  const documentXml = files['word/document.xml']
  if (!documentXml) throw new Error('Not a .docx file (word/document.xml is missing)')

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: true,
    trimValues: false
  })
  const doc = parser.parse(strFromU8(documentXml)) as OrderedNode[]

  const body = descend(doc, ['w:document', 'w:body'])
  if (!body) throw new Error('Unrecognized .docx structure')

  const importLines: ImportLine[] = []
  for (const node of children(body)) {
    if (nodeName(node) === 'w:p') importLines.push(paragraphToLine(node))
  }

  const { titlePage, rest } = extractTitlePage(importLines.map((l) => l.text))
  const trimmed = importLines.slice(importLines.length - rest.length)
  const classified = classifyLines(trimmed)
  return { script: buildScript(classified, titlePage, options.idGenerator), lines: classified }
}

interface OrderedNode {
  [key: string]: unknown
  ':@'?: Record<string, string>
}

function nodeName(node: OrderedNode): string {
  return Object.keys(node).find((k) => k !== ':@') ?? ''
}

function children(node: OrderedNode): OrderedNode[] {
  const value = node[nodeName(node)]
  return Array.isArray(value) ? (value as OrderedNode[]) : []
}

function descend(nodes: OrderedNode[], path: string[]): OrderedNode | null {
  let current: OrderedNode | undefined
  let level = nodes
  for (const name of path) {
    current = level.find((n) => nodeName(n) === name)
    if (!current) return null
    level = children(current)
  }
  return current ?? null
}

/** US Letter usable width in twips (8.5" minus 1" margins each side). */
const USABLE_WIDTH_TWIPS = (8.5 - 2) * 1440

function paragraphToLine(p: OrderedNode): ImportLine {
  let text = ''
  let centered = false
  let bold = false
  let indent: number | undefined

  const walk = (nodes: OrderedNode[]): void => {
    for (const node of nodes) {
      const name = nodeName(node)
      if (name === 'w:pPr') {
        const jc = descend(children(node), ['w:jc'])
        if (jc?.[':@']?.['@_w:val'] === 'center') centered = true
        const ind = descend(children(node), ['w:ind'])
        const left = ind?.[':@']?.['@_w:left'] ?? ind?.[':@']?.['@_w:start']
        if (left !== undefined) {
          const twips = Number(left)
          if (Number.isFinite(twips) && twips > 0) {
            indent = Math.min(1, twips / USABLE_WIDTH_TWIPS)
          }
        }
      } else if (name === 'w:rPr') {
        if (children(node).some((c) => nodeName(c) === 'w:b')) bold = true
      } else if (name === 'w:t') {
        for (const t of children(node)) {
          const value = t['#text']
          if (value !== undefined) text += String(value)
        }
      } else if (name === 'w:tab') {
        text += '\t'
      } else if (name === 'w:br') {
        text += ' '
      } else if (name === 'w:r' || name === 'w:hyperlink' || name === 'w:smartTag') {
        walk(children(node))
      }
    }
  }
  walk(children(p))

  const line: ImportLine = { text }
  if (centered) line.centered = true
  if (bold) line.bold = true
  if (indent !== undefined) line.indent = indent
  return line
}
