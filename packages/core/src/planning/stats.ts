import type { Script, ScriptElement } from '../model/types'
import { paginate } from '../pagination/paginate'
import { DEFAULT_PAGINATION, type PaginationConfig } from '../pagination/config'

/**
 * Derived data for the planning views: character tallies, scene heading
 * facts, per-scene page lengths from the real pagination engine, and the
 * outline tree. All pure functions over the Script model.
 */

/** "EDWARD (V.O.) ^" and "edward (CONT'D)" both compare as EDWARD. */
export function baseCharacterName(cue: string): string {
  return cue
    .replace(/\^\s*$/, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toUpperCase()
}

export interface CharacterStat {
  name: string
  /** Number of speeches (cues), dual-dialogue cues counted once each. */
  cues: number
  /** Number of distinct scenes the character speaks in. */
  scenes: number
  /** Scene heading element IDs where the character speaks, script order. */
  sceneIds: string[]
}

export function characterStats(script: Script): CharacterStat[] {
  const byName = new Map<string, CharacterStat>()
  let currentSceneId: string | null = null
  const seenInScene = new Set<string>()

  for (const el of script.elements) {
    if (el.type === 'scene_heading') {
      currentSceneId = el.id
      seenInScene.clear()
      continue
    }
    if (el.type !== 'character') continue
    const name = baseCharacterName(el.text)
    if (name.length === 0) continue
    let stat = byName.get(name)
    if (!stat) {
      stat = { name, cues: 0, scenes: 0, sceneIds: [] }
      byName.set(name, stat)
    }
    stat.cues++
    if (currentSceneId && !seenInScene.has(name)) {
      seenInScene.add(name)
      stat.scenes++
      stat.sceneIds.push(currentSceneId)
    }
  }

  return [...byName.values()].sort((a, b) => b.cues - a.cues || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Scene heading facts
// ---------------------------------------------------------------------------

export interface HeadingInfo {
  intExt: 'INT' | 'EXT' | 'INT/EXT' | null
  /** "DAY", "NIGHT", "CONTINUOUS"... the part after the last " - ", uppercased. */
  timeOfDay: string | null
}

export function parseHeadingInfo(heading: string): HeadingInfo {
  const t = heading.trim().toUpperCase()
  let intExt: HeadingInfo['intExt'] = null
  if (/^(INT\.?\/EXT|I\/E)[.\s]/.test(t)) intExt = 'INT/EXT'
  else if (/^INT[.\s]/.test(t)) intExt = 'INT'
  else if (/^(EXT|EST)[.\s]/.test(t)) intExt = 'EXT'

  const parts = t.split(/\s+-+\s+/)
  const last = parts.length > 1 ? parts[parts.length - 1]!.trim() : ''
  const timeOfDay = last.length > 0 && last.length <= 24 ? last : null
  return { intExt, timeOfDay }
}

// ---------------------------------------------------------------------------
// Per-scene page lengths, from the real paginator
// ---------------------------------------------------------------------------

export interface ScenePages {
  sceneId: string
  /** Lines this scene occupies across all pages (blanks included). */
  lines: number
  /** Fractional pages, lines / linesPerPage. One page is about one minute. */
  pages: number
  /** Nearest eighth of a page, minimum 1/8, the industry habit. */
  eighths: number
  /** 1-based page the scene starts on. */
  startPage: number
}

export function scenePageStats(
  script: Script,
  config: Partial<PaginationConfig> = {}
): ScenePages[] {
  // Map every element to the scene heading that owns it
  const owner = new Map<string, string>()
  let current: string | null = null
  for (const el of script.elements) {
    if (el.type === 'scene_heading') current = el.id
    if (current) owner.set(el.id, current)
  }

  const linesPerPage = config.linesPerPage ?? DEFAULT_PAGINATION.linesPerPage
  const pages = paginate(script, config)
  const stats = new Map<string, ScenePages>()
  const order: string[] = []
  let active: string | null = null

  for (let p = 0; p < pages.length; p++) {
    for (const line of pages[p]!.lines) {
      if (line.elementId) {
        const scene = owner.get(line.elementId)
        if (scene && scene !== active) active = scene
      }
      if (!active) continue // front matter before the first scene heading
      let stat = stats.get(active)
      if (!stat) {
        stat = { sceneId: active, lines: 0, pages: 0, eighths: 1, startPage: p + 1 }
        stats.set(active, stat)
        order.push(active)
      }
      stat.lines++
    }
  }

  // Scenes so short they produced no lines (empty heading only) still count
  for (const el of script.elements) {
    if (el.type === 'scene_heading' && !stats.has(el.id)) {
      stats.set(el.id, { sceneId: el.id, lines: 1, pages: 0, eighths: 1, startPage: 1 })
      order.push(el.id)
    }
  }

  for (const stat of stats.values()) {
    stat.pages = stat.lines / linesPerPage
    stat.eighths = Math.max(1, Math.round(stat.pages * 8))
  }
  return order.map((id) => stats.get(id)!)
}

// ---------------------------------------------------------------------------
// Outline tree: sections (#, ##, ###) with their scenes
// ---------------------------------------------------------------------------

export interface OutlineNode {
  kind: 'section' | 'scene'
  /** Element ID of the section or scene heading. */
  id: string
  text: string
  /** Sections only: 1 for #, 2 for ##, and so on. */
  depth: number
  children: OutlineNode[]
}

export function buildOutline(script: Script): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: OutlineNode[] = [] // open sections, by depth

  const parentFor = (depth: number): OutlineNode[] => {
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) stack.pop()
    return stack.length > 0 ? stack[stack.length - 1]!.children : roots
  }

  for (const el of script.elements) {
    if (el.type === 'section') {
      const depth = el.depth ?? 1
      const node: OutlineNode = { kind: 'section', id: el.id, text: el.text, depth, children: [] }
      parentFor(depth).push(node)
      stack.push(node)
    } else if (el.type === 'scene_heading') {
      const target = stack.length > 0 ? stack[stack.length - 1]!.children : roots
      target.push({ kind: 'scene', id: el.id, text: el.text, depth: 0, children: [] })
    }
  }
  return roots
}

/** First synopsis in a scene, else its first action line, for card bodies. */
export function sceneCardBody(
  elements: ScriptElement[],
  sceneIndex: number
): { text: string; isFallback: boolean } {
  for (let i = sceneIndex + 1; i < elements.length; i++) {
    const el = elements[i]!
    if (el.type === 'scene_heading') break
    if (el.type === 'synopsis' && el.text.trim().length > 0) {
      return { text: el.text.trim(), isFallback: false }
    }
  }
  for (let i = sceneIndex + 1; i < elements.length; i++) {
    const el = elements[i]!
    if (el.type === 'scene_heading') break
    if (el.type === 'action' && el.text.trim().length > 0) {
      return { text: el.text.trim().split('\n')[0]!, isFallback: true }
    }
  }
  return { text: '', isFallback: true }
}
