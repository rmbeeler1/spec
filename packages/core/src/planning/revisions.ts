import type { ElementType, Script } from '../model/types'

/**
 * Revision mode. Sets (Blue, Pink...) and per-element marks live in the
 * sidecar; the Fountain file stays clean. Marks cannot key off element IDs
 * across sessions (Fountain stores none), so each mark is anchored by the
 * scene heading it sits under plus the element's type and text, and gets
 * re-attached to the freshly parsed script on load. A mark whose element
 * text changed without an active set stays stored and re-matches if the
 * edit is undone.
 */

export interface RevisionSetDef {
  id: string
  name: string
  /** Standard revision color name (see REVISION_COLORS). */
  color: string
  startedAt: string
  closedAt?: string
}

export interface RevisionMark {
  setId: string
  /** Heading of the scene the element sits under ('' before any scene). */
  scene: string
  type: ElementType
  /** Full element text snapshot, the match anchor. */
  text: string
}

export interface RevisionsData {
  sets: RevisionSetDef[]
  activeSetId?: string
  marks: RevisionMark[]
}

/** The industry color order for revision sets. */
export const REVISION_COLORS: Array<{ name: string; value: string }> = [
  { name: 'Blue', value: '#3d6fa8' },
  { name: 'Pink', value: '#d16ba5' },
  { name: 'Yellow', value: '#a8891c' },
  { name: 'Green', value: '#3d8a4e' },
  { name: 'Goldenrod', value: '#b8860b' },
  { name: 'Buff', value: '#c9a66b' },
  { name: 'Salmon', value: '#e07a5f' },
  { name: 'Cherry', value: '#c44536' }
]

export function revisionColorValue(name: string): string {
  return REVISION_COLORS.find((c) => c.name === name)?.value ?? '#b4532a'
}

export function nextRevisionColor(existingSets: number): string {
  return REVISION_COLORS[existingSets % REVISION_COLORS.length]!.name
}

/**
 * Re-attach stored marks to a freshly parsed script. Matching is scene
 * heading + element type + exact text, first unmatched occurrence wins.
 * Returns live marks keyed by element ID plus the marks that found no home
 * (kept, so an undone edit brings them back).
 */
export function attachRevisionMarks(
  script: Script,
  marks: RevisionMark[]
): { live: Map<string, string>; unmatched: RevisionMark[] } {
  const live = new Map<string, string>()
  const unmatched: RevisionMark[] = []
  const used = new Set<string>()
  let scene = ''
  const index: Array<{ id: string; scene: string; type: ElementType; text: string }> = []
  for (const el of script.elements) {
    if (el.type === 'scene_heading') scene = el.text
    index.push({ id: el.id, scene, type: el.type, text: el.text })
  }
  for (const mark of marks) {
    const hit = index.find(
      (e) =>
        !used.has(e.id) && e.scene === mark.scene && e.type === mark.type && e.text === mark.text
    )
    if (hit) {
      used.add(hit.id)
      live.set(hit.id, mark.setId)
    } else {
      unmatched.push(mark)
    }
  }
  return { live, unmatched }
}

/** Snapshot live marks back into storable anchors, keeping unmatched ones. */
export function snapshotRevisionMarks(
  script: Script,
  live: Map<string, string>,
  unmatched: RevisionMark[]
): RevisionMark[] {
  const out: RevisionMark[] = []
  let scene = ''
  for (const el of script.elements) {
    if (el.type === 'scene_heading') scene = el.text
    const setId = live.get(el.id)
    if (setId) out.push({ setId, scene, type: el.type, text: el.text })
  }
  return [...out, ...unmatched]
}
