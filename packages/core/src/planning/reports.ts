import type { Script } from '../model/types'
import type { PaginationConfig } from '../pagination/config'
import { baseCharacterName, characterStats, parseHeadingInfo, scenePageStats } from './stats'

/**
 * Production reports: tables computed from the script, exportable as plain
 * text and CSV. Everything derives from the same core stats the planning
 * views use, so the numbers can never disagree.
 */

export interface ReportTable {
  id: string
  title: string
  columns: string[]
  rows: string[][]
}

/** "INT. HOUSE - DAY" -> "HOUSE": the location without prefix and time. */
export function headingLocation(heading: string): string {
  let t = heading.trim().toUpperCase()
  t = t.replace(/^(INT\.?\/EXT|INT|EXT|EST|I\/E)[.\s]+/i, '')
  const parts = t.split(/\s+-+\s+/)
  if (parts.length > 1) parts.pop()
  return parts.join(' - ').trim()
}

export function buildReports(
  script: Script,
  pagination: Partial<PaginationConfig> = {}
): ReportTable[] {
  const scenes = script.elements.filter((e) => e.type === 'scene_heading')
  const pages = new Map(scenePageStats(script, pagination).map((s) => [s.sceneId, s]))
  const chars = characterStats(script)
  const headingById = new Map(scenes.map((s) => [s.id, s.text]))

  const eighths = (n: number): string => {
    const whole = Math.floor(n / 8)
    const rest = n % 8
    if (whole === 0) return `${rest}/8`
    return rest === 0 ? `${whole}` : `${whole} ${rest}/8`
  }

  const sceneList: ReportTable = {
    id: 'scenes',
    title: 'Scenes',
    columns: ['#', 'Heading', 'Page', 'Length'],
    rows: scenes.map((s, i) => {
      const p = pages.get(s.id)
      return [
        s.sceneNumber ?? String(i + 1),
        s.text,
        String(p?.startPage ?? ''),
        p ? eighths(p.eighths) : ''
      ]
    })
  }

  // Words of dialogue per character, for the dialogue report
  const words = new Map<string, number>()
  let speaker: string | null = null
  for (const el of script.elements) {
    if (el.type === 'character') speaker = baseCharacterName(el.text)
    else if (el.type === 'dialogue' && speaker) {
      const count = el.text.split(/\s+/).filter((w) => w.length > 0).length
      words.set(speaker, (words.get(speaker) ?? 0) + count)
    } else if (el.type === 'scene_heading' || el.type === 'transition') speaker = null
  }

  const characters: ReportTable = {
    id: 'characters',
    title: 'Characters',
    columns: ['Character', 'Speeches', 'Words', 'Scenes', 'First appears in'],
    rows: chars.map((c) => [
      c.name,
      String(c.cues),
      String(words.get(c.name) ?? 0),
      String(c.scenes),
      c.sceneIds[0] ? (headingById.get(c.sceneIds[0]) ?? '') : ''
    ])
  }

  const locCount = new Map<string, number>()
  for (const s of scenes) {
    const loc = headingLocation(s.text) || '(no location)'
    locCount.set(loc, (locCount.get(loc) ?? 0) + 1)
  }
  const locations: ReportTable = {
    id: 'locations',
    title: 'Locations',
    columns: ['Location', 'Scenes'],
    rows: [...locCount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, n]) => [name, String(n)])
  }

  const intExtCount = new Map<string, number>()
  const todCount = new Map<string, number>()
  for (const s of scenes) {
    const info = parseHeadingInfo(s.text)
    const ie = info.intExt ?? '(none)'
    intExtCount.set(ie, (intExtCount.get(ie) ?? 0) + 1)
    const tod = info.timeOfDay ?? '(none)'
    todCount.set(tod, (todCount.get(tod) ?? 0) + 1)
  }
  const sorted = (m: Map<string, number>): string[][] =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)])

  const intExt: ReportTable = {
    id: 'int-ext',
    title: 'INT / EXT',
    columns: ['Type', 'Scenes'],
    rows: sorted(intExtCount)
  }
  const dayNight: ReportTable = {
    id: 'day-night',
    title: 'Time of day',
    columns: ['Time', 'Scenes'],
    rows: sorted(todCount)
  }

  return [sceneList, characters, locations, intExt, dayNight]
}

export function reportToCsv(table: ReportTable): string {
  const cell = (s: string): string =>
    /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  return [table.columns, ...table.rows].map((r) => r.map(cell).join(',')).join('\n') + '\n'
}

export function reportToText(table: ReportTable): string {
  const widths = table.columns.map((c, i) =>
    Math.max(c.length, ...table.rows.map((r) => (r[i] ?? '').length))
  )
  const line = (cells: string[]): string =>
    cells.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd()
  return [
    table.title,
    '',
    line(table.columns),
    line(widths.map((w) => '-'.repeat(w))),
    ...table.rows.map(line),
    ''
  ].join('\n')
}
