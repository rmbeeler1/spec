import type { TitlePageEntry } from './types'
import type { PaginationConfig } from '../pagination/config'

/**
 * Document formats beyond the screenplay. The format travels in the Fountain
 * title page as a plain "Format:" key, so any editor can see it and nothing
 * breaks when it is missing. Each format adjusts element layout (indents and
 * widths) in the editor and the PDF; the Final Draft pagination parity
 * promise applies to the screenplay format only.
 */

export type ScriptFormat = 'screenplay' | 'stageplay' | 'audio' | 'comic'

export function scriptFormat(titlePage: TitlePageEntry[]): ScriptFormat {
  const raw = titlePage
    .find((e) => e.key.toLowerCase() === 'format')?.values[0]?.trim()
    .toLowerCase()
  if (raw === 'stage play' || raw === 'stageplay') return 'stageplay'
  if (raw === 'audio drama' || raw === 'audio') return 'audio'
  if (raw === 'comic') return 'comic'
  return 'screenplay'
}

/** Layout overrides per format; screenplay (and comic) use the standard. */
export function formatConfigFor(format: ScriptFormat): Partial<PaginationConfig> {
  switch (format) {
    case 'stageplay':
      // Stage convention: cues at the left margin, dialogue full width,
      // stage directions (action) indented and narrower
      return {
        indents: { character: 0, dialogue: 0, parenthetical: 4, action: 10 },
        widths: { character: 60, dialogue: 60, parenthetical: 50, action: 45 }
      }
    case 'audio':
      // Audio drama: cues at the margin, dialogue in a wide block beside
      return {
        indents: { character: 0, dialogue: 15, parenthetical: 15 },
        widths: { character: 60, dialogue: 45, parenthetical: 40 }
      }
    default:
      return {}
  }
}
