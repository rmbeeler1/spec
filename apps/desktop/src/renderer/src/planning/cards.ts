import {
  parseHeadingInfo,
  sceneCardBody,
  scenePageStats,
  type PlanningData,
  type Script
} from '@spec/core'
import { sceneMetaMap } from './planningState'

/**
 * The scene card model the corkboard and pacing views render. Built from the
 * live script (via docToScript) joined with the planning sidecar.
 */

export interface SceneCard {
  id: string
  /** 0-based position in script order; reorders use this. */
  index: number
  heading: string
  body: string
  /** True when body is the first action line standing in for a synopsis. */
  bodyIsFallback: boolean
  intExt: 'INT' | 'EXT' | 'INT/EXT' | null
  timeOfDay: string | null
  pages: number
  eighths: number
  startPage: number
  color?: string
  tags: string[]
  storylines: string[]
  /** 1..5, or null when the writer has not set one. Never defaults to zero. */
  tension: number | null
}

export function buildSceneCards(script: Script, planning: PlanningData): SceneCard[] {
  const meta = sceneMetaMap(planning)
  const stats = new Map(scenePageStats(script).map((s) => [s.sceneId, s]))
  const cards: SceneCard[] = []

  script.elements.forEach((el, i) => {
    if (el.type !== 'scene_heading') return
    const m = meta.get(el.id)
    const stat = stats.get(el.id)
    const info = parseHeadingInfo(el.text)
    const body = sceneCardBody(script.elements, i)
    cards.push({
      id: el.id,
      index: cards.length,
      heading: el.text,
      body: body.text,
      bodyIsFallback: body.isFallback,
      intExt: info.intExt,
      timeOfDay: info.timeOfDay,
      pages: stat?.pages ?? 0,
      eighths: stat?.eighths ?? 1,
      startPage: stat?.startPage ?? 1,
      color: m?.color,
      tags: m?.tags ?? [],
      storylines: m?.storylines ?? [],
      tension: m?.tension ?? null
    })
  })
  return cards
}

/** "1 2/8" style page length for a card, from fractional pages. */
export function formatEighths(eighths: number): string {
  const whole = Math.floor(eighths / 8)
  const rest = eighths % 8
  if (whole === 0) return `${rest}/8`
  if (rest === 0) return `${whole}`
  return `${whole} ${rest}/8`
}

/** Rough runtime at one page per minute, shown as "~12 min". */
export function formatMinutes(pages: number): string {
  const min = Math.max(1, Math.round(pages))
  return `~${min} min`
}

export interface PacingLane {
  /** Act title from a depth-1 section, or null before the first section. */
  title: string | null
  cardIndexes: number[]
}

/** Group scene cards into act lanes split by depth-1 sections. */
export function pacingLanes(script: Script, cards: SceneCard[]): PacingLane[] {
  const lanes: PacingLane[] = []
  let current: PacingLane = { title: null, cardIndexes: [] }
  let cardIndex = 0

  for (const el of script.elements) {
    if (el.type === 'section' && (el.depth ?? 1) === 1) {
      if (current.cardIndexes.length > 0 || current.title !== null) lanes.push(current)
      current = { title: el.text, cardIndexes: [] }
    } else if (el.type === 'scene_heading') {
      current.cardIndexes.push(cardIndex++)
    }
  }
  lanes.push(current)
  return lanes.filter((l) => l.cardIndexes.length > 0 || l.title !== null)
}
