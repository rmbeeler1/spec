import type { ElementType, Script, ScriptElement } from '../model/types'
import { parseEmphasis, type StyleSpan } from '../text/emphasis'

/**
 * Write the document model as Final Draft FDX (XML). Sections, synopses,
 * notes and boneyards are Fountain planning constructs with no FDX home;
 * they are omitted from the exported script.
 */
export function writeFdx(script: Script): string {
  const out: string[] = []
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>')
  out.push('<FinalDraft DocumentType="Script" Template="No" Version="5">')
  out.push('  <Content>')

  const els = script.elements.filter((e) => isExported(e.type))
  let i = 0
  while (i < els.length) {
    const el = els[i]!
    if (el.type === 'character') {
      const blockEnd = dialogueBlockEnd(els, i)
      const nextIsDual = blockEnd < els.length && els[blockEnd]!.type === 'character' && els[blockEnd]!.dual === true
      if (nextIsDual) {
        const secondEnd = dialogueBlockEnd(els, blockEnd)
        out.push('    <DualDialogue>')
        for (let k = i; k < secondEnd; k++) out.push(paragraph(els[k]!, '      '))
        out.push('    </DualDialogue>')
        i = secondEnd
        continue
      }
      for (let k = i; k < blockEnd; k++) out.push(paragraph(els[k]!, '    '))
      i = blockEnd
      continue
    }
    out.push(paragraph(el, '    '))
    i++
  }

  out.push('  </Content>')
  out.push(titlePageXml(script))
  out.push('</FinalDraft>')
  return out.join('\n') + '\n'
}

function isExported(type: ElementType): boolean {
  return !['section', 'synopsis', 'note', 'boneyard'].includes(type)
}

function dialogueBlockEnd(els: ScriptElement[], start: number): number {
  let j = start + 1
  while (
    j < els.length &&
    (els[j]!.type === 'dialogue' || els[j]!.type === 'parenthetical' || els[j]!.type === 'lyric')
  ) {
    j++
  }
  return j
}

const FDX_TYPE: Partial<Record<ElementType, string>> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  lyric: 'Dialogue',
  centered: 'Action',
  page_break: 'Action'
}

function paragraph(el: ScriptElement, pad: string): string {
  if (el.type === 'page_break') {
    return `${pad}<Paragraph Type="Action" StartsNewPage="Yes"><Text></Text></Paragraph>`
  }
  const type = FDX_TYPE[el.type] ?? 'Action'
  const attrs: string[] = [`Type="${type}"`]
  if (el.type === 'scene_heading' && el.sceneNumber) attrs.push(`Number="${escapeXml(el.sceneNumber)}"`)
  if (el.type === 'centered') attrs.push('Alignment="Center"')

  const { text, spans } = parseEmphasis(el.text)
  const runs = textRuns(text.replace(/\n/g, ' '), spans)
  return `${pad}<Paragraph ${attrs.join(' ')}>${runs}</Paragraph>`
}

/** Split styled text into <Text> runs at style boundaries. */
function textRuns(text: string, spans: StyleSpan[]): string {
  if (text.length === 0) return '<Text></Text>'
  const cuts = new Set<number>([0, text.length])
  for (const s of spans) {
    if (s.start < text.length) cuts.add(Math.max(0, s.start))
    cuts.add(Math.min(text.length, s.end))
  }
  const points = [...cuts].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const styles: string[] = []
    const active = spans.find((s) => s.start <= a && s.end >= b)
    if (active?.bold) styles.push('Bold')
    if (active?.italic) styles.push('Italic')
    if (active?.underline) styles.push('Underline')
    const styleAttr = styles.length > 0 ? ` Style="${styles.join('+')}"` : ''
    parts.push(`<Text${styleAttr}>${escapeXml(text.slice(a, b))}</Text>`)
  }
  return parts.join('')
}

function titlePageXml(script: Script): string {
  if (script.titlePage.length === 0) return '  <TitlePage><Content></Content></TitlePage>'
  const lines: string[] = ['  <TitlePage>', '    <Content>']
  for (const entry of script.titlePage) {
    for (const value of entry.values) {
      lines.push(
        `      <Paragraph Type="Action" Alignment="Center"><Text>${escapeXml(value)}</Text></Paragraph>`
      )
    }
  }
  lines.push('    </Content>', '  </TitlePage>')
  return lines.join('\n')
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
