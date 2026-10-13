import type { ClassifiedLine, ClassifiedType } from '@spec/core'

/** Below this confidence a line gets flagged for human review. */
export const DOUBT_THRESHOLD = 0.7

/** Indices of non-blank lines, in document order or doubtful-first. */
export function visibleIndices(lines: ClassifiedLine[], doubtfulFirst: boolean): number[] {
  const indices = lines.map((_, i) => i).filter((i) => lines[i]!.type !== 'blank')
  if (!doubtfulFirst) return indices
  return indices.sort((a, b) => lines[a]!.confidence - lines[b]!.confidence || a - b)
}

export function doubtfulCount(lines: ClassifiedLine[]): number {
  return lines.filter((l) => l.type !== 'blank' && l.confidence < DOUBT_THRESHOLD).length
}

/** Set a type on every selected line; the human choice gets confidence 1. */
export function applyTypeToSelection(
  lines: ClassifiedLine[],
  selected: ReadonlySet<number>,
  type: ClassifiedType
): ClassifiedLine[] {
  return lines.map((line, i) =>
    selected.has(i) && line.type !== 'blank' ? { ...line, type, confidence: 1 } : line
  )
}

export function selectDoubtful(lines: ClassifiedLine[]): Set<number> {
  const out = new Set<number>()
  lines.forEach((l, i) => {
    if (l.type !== 'blank' && l.confidence < DOUBT_THRESHOLD) out.add(i)
  })
  return out
}

/**
 * One-line summary with a sanity check. A screenplay import with no scene
 * headings, or cues but no dialogue, almost always means the source lost its
 * structure; say so plainly instead of letting a broken import look fine.
 */
export function importSummary(lines: ClassifiedLine[]): { text: string; suspicious: boolean } {
  const count = (type: string): number => lines.filter((l) => l.type === type).length
  const scenes = count('scene_heading')
  const cues = count('character')
  const dialogue = count('dialogue')
  const doubtful = doubtfulCount(lines)

  const found = `Found ${scenes} scene ${scenes === 1 ? 'heading' : 'headings'}, ${cues} character ${cues === 1 ? 'cue' : 'cues'}, ${dialogue} dialogue ${dialogue === 1 ? 'line' : 'lines'}.`

  if (scenes === 0 && cues > 0) {
    return {
      text: `${found} No scene headings in a script with dialogue is unusual. Check the flagged lines below.`,
      suspicious: true
    }
  }
  if (cues === 0 && scenes > 0) {
    return {
      text: `${found} Scenes but no dialogue is unusual for a screenplay. Check the flagged lines below.`,
      suspicious: true
    }
  }
  if (scenes === 0 && cues === 0) {
    return {
      text: `${found} This does not look like a screenplay; everything imported as action.`,
      suspicious: true
    }
  }
  return {
    text: `${found} ${doubtful === 0 ? 'Nothing flagged.' : `${doubtful} flagged for a look.`}`,
    suspicious: false
  }
}

/** Shift-click selects the whole range between two row indices. */
export function rangeBetween(indices: number[], a: number, b: number): Set<number> {
  const posA = indices.indexOf(a)
  const posB = indices.indexOf(b)
  if (posA === -1 || posB === -1) return new Set([b])
  const [lo, hi] = posA < posB ? [posA, posB] : [posB, posA]
  return new Set(indices.slice(lo, hi + 1))
}
