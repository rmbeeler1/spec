import type { ElementType, Script } from '../model/types'
import type { PageLockAnchor } from '../pagination/paginate'

/**
 * Locked-page anchors persist like revision marks: element IDs do not exist
 * in Fountain, so each anchor stores the scene it sits under plus the
 * element's type and text, and re-attaches on load.
 */

export interface StoredPageAnchor {
  page: string
  scene: string
  type: ElementType
  text: string
  /** Which rendered line of the element starts the page (0-based). */
  lineOffset: number
  /** Disambiguates identical elements: nth (0-based) occurrence of this
   *  scene/type/text combination in the script. */
  occurrence: number
}

function keyOf(scene: string, type: ElementType, text: string): string {
  // Parsing trims line edges, so anchors compare trimmed text
  return `${scene.trim()}\u0000${type}\u0000${text.trim()}`
}

export function attachPageAnchors(script: Script, stored: StoredPageAnchor[]): PageLockAnchor[] {
  // Elements grouped by scene/type/text; occurrence picks among identicals
  const groups = new Map<string, string[]>()
  let scene = ''
  for (const el of script.elements) {
    if (el.type === 'scene_heading') scene = el.text
    const key = keyOf(scene, el.type, el.text)
    const list = groups.get(key) ?? []
    list.push(el.id)
    groups.set(key, list)
  }
  const out: PageLockAnchor[] = []
  for (const a of stored) {
    const id = groups.get(keyOf(a.scene, a.type, a.text))?.[a.occurrence]
    if (id) out.push({ page: a.page, elementId: id, lineOffset: a.lineOffset })
    // A missing anchor means its element was cut; that page label retires
  }
  return out
}

export function snapshotPageAnchors(
  script: Script,
  anchors: PageLockAnchor[]
): StoredPageAnchor[] {
  const byId = new Map<string, { scene: string; type: ElementType; text: string; occurrence: number }>()
  const counts = new Map<string, number>()
  let scene = ''
  for (const el of script.elements) {
    if (el.type === 'scene_heading') scene = el.text
    const key = keyOf(scene, el.type, el.text)
    const occurrence = counts.get(key) ?? 0
    counts.set(key, occurrence + 1)
    byId.set(el.id, { scene, type: el.type, text: el.text, occurrence })
  }
  const out: StoredPageAnchor[] = []
  for (const a of anchors) {
    const e = byId.get(a.elementId)
    if (e) {
      out.push({
        page: a.page,
        scene: e.scene,
        type: e.type,
        text: e.text,
        lineOffset: a.lineOffset,
        occurrence: e.occurrence
      })
    }
  }
  return out
}
