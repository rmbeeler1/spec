import type { BeatCard, BeatLink, PlanningData, SceneMeta, StashEntry } from '@spec/core'

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
