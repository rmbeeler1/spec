/**
 * The planning sidecar: everything Fountain cannot carry, in a JSON file next
 * to the script (MyScript.spec.json beside MyScript.fountain). Script text
 * never goes in here; stashed text lives in MyScript.stash.fountain.
 *
 * Scene entries are keyed by element ID, but Fountain files do not store IDs,
 * so every entry also carries a heading snapshot. On load, entries are
 * re-attached to the freshly parsed script by matching those snapshots
 * (attachSceneMeta below). Entries that match nothing are kept as orphans so
 * planning data is never silently dropped.
 */

export interface SceneMeta {
  /** Element ID of the scene heading this entry was attached to last save. */
  id: string
  /** Heading text snapshot at last save, used to re-attach after reload. */
  heading: string
  color?: string
  tags?: string[]
  /** Storyline ids (see PlanningData.storylines). */
  storylines?: string[]
  /** User-set pacing tension, 1..5. Absent means unset, never zero. */
  tension?: number
}

export interface BeatCard {
  id: string
  title: string
  body: string
  color?: string
  tags?: string[]
  x: number
  y: number
}

export interface BeatLink {
  from: string
  to: string
}

export interface StashEntry {
  id: string
  /** ISO timestamp of when the material was cut. */
  cutAt: string
  /** Heading of the scene it was cut from, when known. */
  fromScene?: string
  /** One-line summary (first non-empty line) for the stash pane. */
  summary: string
}

export interface Storyline {
  id: string
  name: string
  color: string
}

export interface WritingDay {
  /** Local date, YYYY-MM-DD. */
  date: string
  /** Words added that day (deletions never subtract; imports never count). */
  words: number
  /** Net pages added that day, by the real paginator. */
  pages: number
}

export interface WritingGoal {
  kind: 'words' | 'pages'
  perDay: number
}

export interface WritingStats {
  history: WritingDay[]
  goal?: WritingGoal
}

export interface PlanningData {
  version: 1
  scenes: SceneMeta[]
  beats: BeatCard[]
  beatLinks: BeatLink[]
  stash: StashEntry[]
  storylines: Storyline[]
  /** Production: locked numbering gives inserted scenes A-numbers (12A). */
  numberingLocked?: boolean
  /** Writing stats and the per-script daily goal. */
  writing?: WritingStats
}

export function emptyPlanning(): PlanningData {
  return { version: 1, scenes: [], beats: [], beatLinks: [], stash: [], storylines: [] }
}

/** True when there is nothing worth writing to disk. */
export function isPlanningEmpty(data: PlanningData): boolean {
  return (
    data.scenes.length === 0 &&
    data.beats.length === 0 &&
    data.beatLinks.length === 0 &&
    data.stash.length === 0 &&
    data.storylines.length === 0 &&
    data.numberingLocked !== true &&
    (data.writing === undefined ||
      (data.writing.history.length === 0 && data.writing.goal === undefined))
  )
}

export function serializePlanning(data: PlanningData): string {
  return JSON.stringify(data, null, 2) + '\n'
}

/**
 * Parse a sidecar file, tolerantly: unknown fields are dropped, malformed
 * entries are skipped, and anything unreadable yields empty planning rather
 * than blocking the script from opening. Returns the data plus a flag saying
 * whether anything was unreadable, so the app can tell the writer.
 */
export function parsePlanning(json: string): { data: PlanningData; hadErrors: boolean } {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { data: emptyPlanning(), hadErrors: true }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { data: emptyPlanning(), hadErrors: true }
  }
  const o = raw as Record<string, unknown>
  let hadErrors = false
  const arr = (v: unknown): unknown[] => {
    if (v === undefined) return []
    if (Array.isArray(v)) return v
    hadErrors = true
    return []
  }
  const str = (v: unknown): v is string => typeof v === 'string'

  const scenes: SceneMeta[] = []
  for (const s of arr(o['scenes'])) {
    const e = s as Record<string, unknown>
    if (!str(e['id']) || !str(e['heading'])) {
      hadErrors = true
      continue
    }
    const out: SceneMeta = { id: e['id'], heading: e['heading'] }
    if (str(e['color'])) out.color = e['color']
    if (Array.isArray(e['tags'])) out.tags = e['tags'].filter(str)
    if (Array.isArray(e['storylines'])) out.storylines = e['storylines'].filter(str)
    if (typeof e['tension'] === 'number' && e['tension'] >= 1 && e['tension'] <= 5) {
      out.tension = e['tension']
    }
    scenes.push(out)
  }

  const beats: BeatCard[] = []
  for (const b of arr(o['beats'])) {
    const e = b as Record<string, unknown>
    if (!str(e['id']) || typeof e['x'] !== 'number' || typeof e['y'] !== 'number') {
      hadErrors = true
      continue
    }
    const out: BeatCard = {
      id: e['id'],
      title: str(e['title']) ? e['title'] : '',
      body: str(e['body']) ? e['body'] : '',
      x: e['x'],
      y: e['y']
    }
    if (str(e['color'])) out.color = e['color']
    if (Array.isArray(e['tags'])) out.tags = e['tags'].filter(str)
    beats.push(out)
  }

  const beatIds = new Set(beats.map((b) => b.id))
  const beatLinks: BeatLink[] = []
  for (const l of arr(o['beatLinks'])) {
    const e = l as Record<string, unknown>
    if (str(e['from']) && str(e['to']) && beatIds.has(e['from']) && beatIds.has(e['to'])) {
      beatLinks.push({ from: e['from'], to: e['to'] })
    } else {
      hadErrors = true
    }
  }

  const stash: StashEntry[] = []
  for (const s of arr(o['stash'])) {
    const e = s as Record<string, unknown>
    if (!str(e['id'])) {
      hadErrors = true
      continue
    }
    const out: StashEntry = {
      id: e['id'],
      cutAt: str(e['cutAt']) ? e['cutAt'] : '',
      summary: str(e['summary']) ? e['summary'] : ''
    }
    if (str(e['fromScene'])) out.fromScene = e['fromScene']
    stash.push(out)
  }

  const storylines: Storyline[] = []
  for (const s of arr(o['storylines'])) {
    const e = s as Record<string, unknown>
    if (str(e['id']) && str(e['name']) && str(e['color'])) {
      storylines.push({ id: e['id'], name: e['name'], color: e['color'] })
    } else {
      hadErrors = true
    }
  }

  const data: PlanningData = { version: 1, scenes, beats, beatLinks, stash, storylines }
  if (o['numberingLocked'] === true) data.numberingLocked = true

  const w = o['writing'] as Record<string, unknown> | undefined
  if (typeof w === 'object' && w !== null) {
    const history: WritingDay[] = []
    for (const d of arr(w['history'])) {
      const e = d as Record<string, unknown>
      if (str(e['date']) && typeof e['words'] === 'number' && typeof e['pages'] === 'number') {
        history.push({ date: e['date'], words: e['words'], pages: e['pages'] })
      } else {
        hadErrors = true
      }
    }
    const writing: WritingStats = { history }
    const g = w['goal'] as Record<string, unknown> | undefined
    if (
      typeof g === 'object' &&
      g !== null &&
      (g['kind'] === 'words' || g['kind'] === 'pages') &&
      typeof g['perDay'] === 'number' &&
      g['perDay'] > 0
    ) {
      writing.goal = { kind: g['kind'], perDay: g['perDay'] }
    }
    if (history.length > 0 || writing.goal) data.writing = writing
  }
  return { data, hadErrors }
}

// ---------------------------------------------------------------------------
// Sidecar and stash file naming (pure string helpers; path joining is the
// caller's business, these only transform the file name)
// ---------------------------------------------------------------------------

/** "MyScript.fountain" -> "MyScript.spec.json" (any extension accepted). */
export function sidecarPathFor(scriptPath: string): string {
  return `${stripScriptExtension(scriptPath)}.spec.json`
}

/** "MyScript.fountain" -> "MyScript.stash.fountain". */
export function stashPathFor(scriptPath: string): string {
  return `${stripScriptExtension(scriptPath)}.stash.fountain`
}

function stripScriptExtension(scriptPath: string): string {
  return scriptPath.replace(/\.(fountain|txt)$/i, '')
}

// ---------------------------------------------------------------------------
// Re-attaching scene metadata after a reload
// ---------------------------------------------------------------------------

export interface SceneRef {
  id: string
  heading: string
}

export interface AttachResult {
  /** Scene metadata re-keyed to the freshly parsed scene IDs, script order. */
  attached: SceneMeta[]
  /** Entries whose heading no longer exists in the script; kept, not lost. */
  orphans: SceneMeta[]
}

/**
 * Match stored scene entries to the scenes of a freshly parsed script.
 * Headings are matched in order (first unused scene with the same normalized
 * heading), so duplicated headings pair up by position. Matched entries take
 * on the new scene's ID and heading; the rest become orphans.
 */
export function attachSceneMeta(scenes: SceneRef[], entries: SceneMeta[]): AttachResult {
  const normalize = (h: string): string => h.trim().toUpperCase().replace(/\s+/g, ' ')
  const used = new Set<number>()
  const attached: SceneMeta[] = []
  const orphans: SceneMeta[] = []

  for (const entry of entries) {
    const want = normalize(entry.heading)
    const idx = scenes.findIndex((s, i) => !used.has(i) && normalize(s.heading) === want)
    if (idx === -1) {
      orphans.push(entry)
      continue
    }
    used.add(idx)
    attached.push({ ...entry, id: scenes[idx]!.id, heading: scenes[idx]!.heading })
  }
  return { attached, orphans }
}
