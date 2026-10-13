import type { RenderPage } from '@spec/core'

/**
 * Which elements start a new page? For each page after the first, if its
 * first content line belongs to an element that has not appeared on any
 * earlier page, that element begins the page and gets a divider. Elements
 * split mid-way (long action, dialogue with MORE) appeared earlier, so they
 * get no divider; the status bar page count still reflects them.
 */
export function computePageBreakMap(pages: RenderPage[]): Map<string, string> {
  const breaks = new Map<string, string>()
  const seen = new Set<string>()
  for (let p = 0; p < pages.length; p++) {
    const ids = pages[p]!.lines.map((l) => l.elementId).filter((id): id is string => id !== null)
    if (p > 0) {
      const first = ids[0]
      if (first !== undefined && !seen.has(first)) {
        breaks.set(first, pages[p]!.label ?? String(p + 1))
      }
    }
    for (const id of ids) seen.add(id)
  }
  return breaks
}
