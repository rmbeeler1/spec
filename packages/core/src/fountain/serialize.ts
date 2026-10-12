import type { Script, ScriptElement } from '../model/types'

/**
 * Serialize the document model back to Fountain text. The goal is semantic
 * round-trip: parse(serialize(script)) must produce the same elements. Exact
 * whitespace from the original file is not preserved.
 */
export function serializeFountain(script: Script): string {
  const parts: string[] = []

  if (script.titlePage.length > 0) {
    const tp: string[] = []
    for (const entry of script.titlePage) {
      if (entry.values.length === 1 && !entry.values[0]!.includes('\n')) {
        tp.push(`${entry.key}: ${entry.values[0]}`)
      } else {
        tp.push(`${entry.key}:`)
        for (const v of entry.values) tp.push(`\t${v}`)
      }
    }
    parts.push(tp.join('\n'))
  }

  let i = 0
  const elements = script.elements
  while (i < elements.length) {
    const el = elements[i]!
    if (el.type === 'character') {
      // Emit the whole dialogue block with no blank lines inside it
      const block: string[] = [serializeCharacter(el)]
      let j = i + 1
      while (j < elements.length && isDialogueChild(elements[j]!)) {
        block.push(serializeDialogueChild(elements[j]!))
        j++
      }
      parts.push(block.join('\n'))
      i = j
    } else {
      parts.push(serializeElement(el))
      i++
    }
  }

  return parts.join('\n\n') + '\n'
}

function isDialogueChild(el: ScriptElement): boolean {
  return el.type === 'dialogue' || el.type === 'parenthetical' || el.type === 'lyric'
}

function serializeCharacter(el: ScriptElement): string {
  // Force with @ if it was forced, or if the name would not parse as a cue
  const needsForce = el.forced === true || el.text !== el.text.toUpperCase()
  const prefix = needsForce ? '@' : ''
  const suffix = el.dual ? ' ^' : ''
  return `${prefix}${el.text}${suffix}`
}

function serializeDialogueChild(el: ScriptElement): string {
  if (el.type === 'parenthetical') return el.text
  if (el.type === 'lyric') return `~${el.text}`
  // Dialogue: re-emit empty interior lines as the two-space line Fountain uses
  return el.text
    .split('\n')
    .map((l) => (l === '' ? '  ' : l))
    .join('\n')
}

function serializeElement(el: ScriptElement): string {
  switch (el.type) {
    case 'scene_heading': {
      const numberSuffix = el.sceneNumber ? ` #${el.sceneNumber}#` : ''
      const needsForce =
        el.forced === true || !/^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i.test(el.text)
      return `${needsForce ? '.' : ''}${el.text}${numberSuffix}`
    }
    case 'action': {
      // Force with ! if the first line would parse as something else
      const needsForce = el.forced === true || actionWouldMisparse(el.text)
      return needsForce ? `!${el.text}` : el.text
    }
    case 'transition': {
      const needsForce =
        el.forced === true || !(el.text === el.text.toUpperCase() && el.text.endsWith('TO:'))
      return needsForce ? `> ${el.text}` : el.text
    }
    case 'centered':
      return `> ${el.text} <`
    case 'lyric':
      return `~${el.text}`
    case 'section':
      return `${'#'.repeat(el.depth ?? 1)} ${el.text}`
    case 'synopsis':
      return `= ${el.text}`
    case 'note':
      return `[[${el.text}]]`
    case 'boneyard':
      return `/*\n${el.text}\n*/`
    case 'page_break':
      return '==='
    case 'shot':
      // Fountain has no shot element; emit as a forced scene heading
      return `.${el.text}`
    case 'character':
    case 'parenthetical':
    case 'dialogue':
      // Handled in the block logic above; reaching here means a stray element
      return el.text
  }
}

function actionWouldMisparse(text: string): boolean {
  const first = text.split('\n')[0]!.trim()
  if (first === '') return false
  if (/^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i.test(first)) return true
  if (first === first.toUpperCase() && /[A-Z]/.test(first) && first.endsWith('TO:')) return true
  if (first === first.toUpperCase() && /[A-Z]/.test(first)) return true // could be a cue
  if (/^[.>=~#!@[]/.test(first) && !first.startsWith('..')) return true
  return false
}
