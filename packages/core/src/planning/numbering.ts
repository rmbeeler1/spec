/**
 * Scene numbering. Numbers live in the Fountain file itself (#1# markers on
 * headings), so they survive any editor. Locked numbering is production
 * practice: once a draft circulates, scene 12 stays scene 12 forever, and a
 * scene added between 12 and 13 becomes 12A instead of renumbering the rest.
 */

export interface SceneNumberParts {
  base: number
  letters: string
}

export function parseSceneNumber(num: string): SceneNumberParts | null {
  const m = num.trim().match(/^(\d+)([A-Z]*)$/i)
  if (!m) return null
  return { base: parseInt(m[1]!, 10), letters: m[2]!.toUpperCase() }
}

function nextLetters(letters: string): string {
  // A, B ... Z, AA, AB ... (good far beyond any real rewrite)
  if (letters === '') return 'A'
  const chars = letters.split('')
  let i = chars.length - 1
  while (i >= 0) {
    if (chars[i] !== 'Z') {
      chars[i] = String.fromCharCode(chars[i]!.charCodeAt(0) + 1)
      return chars.join('')
    }
    chars[i] = 'A'
    i--
  }
  return 'A' + chars.join('')
}

/**
 * The number for a scene inserted between two locked neighbors.
 * Between 12 and 13 -> 12A; between 12A and 13 -> 12B; after the last scene
 * (next is null) -> one past the previous base; before the first -> A1 style
 * is nonstandard, so 0A keeps order without renumbering (rare in practice).
 */
export function nextSceneNumber(prev: string | null, next: string | null): string {
  const p = prev ? parseSceneNumber(prev) : null
  if (!p) return next ? '0A' : '1'
  if (next === null) return String(p.base + 1)
  return `${p.base}${nextLetters(p.letters)}`
}

/** Sequential numbers 1..N for a full (re)numbering pass. */
export function sequentialSceneNumbers(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1))
}
