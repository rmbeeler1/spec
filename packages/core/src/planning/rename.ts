import type { Script, ScriptElement } from '../model/types'
import { baseCharacterName } from './stats'

/**
 * Rename a character everywhere: cues keep their extensions ((V.O.),
 * (CONT'D)) and dual carets, and prose mentions in action, dialogue and
 * synopses are replaced on whole-word matches, preserving the casing style
 * of each mention (an ALL CAPS introduction stays all caps).
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replace the name part of a character cue, keeping extensions and ^. */
export function renameCue(cueText: string, oldBase: string, newName: string): string {
  if (baseCharacterName(cueText) !== oldBase.toUpperCase()) return cueText
  // The name part runs up to the first extension or the trailing caret
  const m = cueText.match(/^(\s*)([^(]*?)(\s*(?:\(.*)?\^?\s*)$/s)
  if (!m) return cueText
  return `${m[1] ?? ''}${newName.toUpperCase()}${m[3] ?? ''}`
}

/**
 * Replace whole-word mentions in prose. Word edges are any non-letter, so
 * "MAYA" never matches inside "MAYAN". ALL CAPS mentions become the new
 * name upper-cased; anything else takes the new name as typed.
 */
export function renameInProse(text: string, oldBase: string, newName: string): string {
  const pattern = new RegExp(
    `(^|[^\\p{L}])(${escapeRegExp(oldBase)})(?=$|[^\\p{L}])`,
    'giu'
  )
  return text.replace(pattern, (_all, before: string, hit: string) => {
    const replacement = hit === hit.toUpperCase() ? newName.toUpperCase() : newName
    return `${before}${replacement}`
  })
}

/** Apply the rename to a whole script (pure; the editor mirrors this). */
export function renameCharacterInScript(
  script: Script,
  oldBase: string,
  newName: string
): Script {
  const elements: ScriptElement[] = script.elements.map((el) => {
    const text =
      el.type === 'character'
        ? renameCue(el.text, oldBase, newName)
        : el.type === 'action' ||
            el.type === 'dialogue' ||
            el.type === 'parenthetical' ||
            el.type === 'synopsis' ||
            el.type === 'centered' ||
            el.type === 'lyric'
          ? renameInProse(el.text, oldBase, newName)
          : el.text
    return text === el.text ? el : { ...el, text }
  })
  return { ...script, elements }
}
