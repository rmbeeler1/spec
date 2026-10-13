import type {
  BeatCard,
  BeatLink,
  PlanningData,
  SceneMeta,
  StashEntry,
  WritingGoal
} from '@spec/core'

/** Local calendar date as YYYY-MM-DD (never UTC: writing days are your days). */
export function localDay(d = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Add words/pages written to the given day's tally. Negatives never count. */
export function recordWriting(
  data: PlanningData,
  date: string,
  wordsDelta: number,
  pagesDelta: number
): PlanningData {
  const words = Math.max(0, wordsDelta)
  const pages = Math.max(0, pagesDelta)
  if (words === 0 && pages === 0) return data
  const history = [...(data.writing?.history ?? [])]
  const i = history.findIndex((h) => h.date === date)
  if (i === -1) history.push({ date, words, pages })
  else history[i] = { ...history[i]!, words: history[i]!.words + words, pages: history[i]!.pages + pages }
  history.sort((a, b) => a.date.localeCompare(b.date))
  return { ...data, writing: { ...(data.writing ?? {}), history } }
}

export function setWritingGoal(data: PlanningData, goal: WritingGoal | undefined): PlanningData {
  const history = data.writing?.history ?? []
  if (!goal && history.length === 0) {
    const next = { ...data }
    delete next.writing
    return next
  }
  return { ...data, writing: { history, ...(goal ? { goal } : {}) } }
}

/**
 * Immutable update helpers for the planning sidecar data. All of them return
 * a new PlanningData so React state and the dirty flag stay simple.
 */

export function sceneMetaMap(data: PlanningData): Map<string, SceneMeta> {
  return new Map(data.scenes.map((s) => [s.id, s]))
}

/** Patch (or create) a scene's metadata. Empty entries are dropped. */
export function patchSceneMeta(
  data: PlanningData,
  sceneId: string,
  heading: string,
  patch: Partial<Omit<SceneMeta, 'id' | 'heading'>>
): PlanningData {
  const existing = data.scenes.find((s) => s.id === sceneId)
  const merged: SceneMeta = { ...(existing ?? { id: sceneId, heading }), heading, ...patch }
  // undefined values in the patch mean "clear this field"
  for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
    if (patch[key] === undefined) delete merged[key]
  }
  const isEmpty =
    merged.color === undefined &&
    (merged.tags === undefined || merged.tags.length === 0) &&
    (merged.storylines === undefined || merged.storylines.length === 0) &&
    merged.tension === undefined

  const others = data.scenes.filter((s) => s.id !== sceneId)
  return { ...data, scenes: isEmpty ? others : [...others, merged] }
}

/** Refresh heading snapshots so re-attachment keeps working after renames. */
export function refreshHeadings(
  data: PlanningData,
  scenes: Array<{ id: string | null; heading: string }>
): PlanningData {
  const byId = new Map(scenes.filter((s) => s.id).map((s) => [s.id!, s.heading]))
  let changed = false
  const next = data.scenes.map((s) => {
    const heading = byId.get(s.id)
    if (heading !== undefined && heading !== s.heading) {
      changed = true
      return { ...s, heading }
    }
    return s
  })
  return changed ? { ...data, scenes: next } : data
}

/** Scene entries that no longer point at any scene in the open script. */
export function orphanSceneEntries(data: PlanningData, sceneIds: Set<string>): SceneMeta[] {
  return data.scenes.filter((s) => !sceneIds.has(s.id))
}

/**
 * Re-attach an orphaned entry to a scene the writer picked: the orphan's
 * fields merge onto the target scene's entry (the orphan wins where both
 * have a value) and the orphan itself goes away.
 */
export function reattachSceneMeta(
  data: PlanningData,
  orphanId: string,
  target: { id: string; heading: string }
): PlanningData {
  const orphan = data.scenes.find((s) => s.id === orphanId)
  if (!orphan) return data
  const without = { ...data, scenes: data.scenes.filter((s) => s.id !== orphanId) }
  return patchSceneMeta(without, target.id, target.heading, {
    ...(orphan.color !== undefined ? { color: orphan.color } : {}),
    ...(orphan.tags !== undefined ? { tags: orphan.tags } : {}),
    ...(orphan.storylines !== undefined ? { storylines: orphan.storylines } : {}),
    ...(orphan.tension !== undefined ? { tension: orphan.tension } : {})
  })
}

/** Drop a scene entry entirely (a dead orphan the writer discards). */
export function removeSceneMeta(data: PlanningData, sceneId: string): PlanningData {
  return { ...data, scenes: data.scenes.filter((s) => s.id !== sceneId) }
}

export function upsertBeat(data: PlanningData, beat: BeatCard): PlanningData {
  const others = data.beats.filter((b) => b.id !== beat.id)
  return { ...data, beats: [...others, beat] }
}

export function removeBeat(data: PlanningData, beatId: string): PlanningData {
  return {
    ...data,
    beats: data.beats.filter((b) => b.id !== beatId),
    beatLinks: data.beatLinks.filter((l) => l.from !== beatId && l.to !== beatId)
  }
}

export function toggleBeatLink(data: PlanningData, link: BeatLink): PlanningData {
  const same = (l: BeatLink): boolean =>
    (l.from === link.from && l.to === link.to) || (l.from === link.to && l.to === link.from)
  const without = data.beatLinks.filter((l) => !same(l))
  if (without.length < data.beatLinks.length) return { ...data, beatLinks: without }
  if (link.from === link.to) return data
  return { ...data, beatLinks: [...data.beatLinks, link] }
}

export function addStashEntry(data: PlanningData, entry: StashEntry): PlanningData {
  return { ...data, stash: [entry, ...data.stash.filter((s) => s.id !== entry.id)] }
}

export function removeStashEntry(data: PlanningData, entryId: string): PlanningData {
  return { ...data, stash: data.stash.filter((s) => s.id !== entryId) }
}
