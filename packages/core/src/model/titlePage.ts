import type { TitlePageEntry } from './types'

/**
 * The three regions of a standard title page: a centered block about a third
 * of the way down (title, credit, author, source), a contact block at the
 * bottom left, and a draft date block at the bottom right. The PDF exporter
 * and the editor's page-zero preview both render from this, so they always
 * agree on what the title page contains.
 */
export interface TitlePageBlocks {
  /** Lines of the centered block; empty strings are blank spacer lines. */
  centered: string[]
  /** Bottom-left lines: Contact then Copyright. */
  contact: string[]
  /** Bottom-right lines: Draft date then Date. */
  draft: string[]
}

export function titlePageBlocks(titlePage: TitlePageEntry[]): TitlePageBlocks {
  const get = (key: string): string[] =>
    titlePage.find((e) => e.key.toLowerCase() === key.toLowerCase())?.values ?? []

  const centered: string[] = []
  const title = get('Title')
  if (title.length > 0) centered.push(...title.map((t) => stripMarkers(t)), '')
  const credit = get('Credit')
  if (credit.length > 0) centered.push(...credit, '')
  centered.push(...get('Author'), ...get('Authors'))
  const source = get('Source')
  if (source.length > 0) centered.push('', ...source)

  return {
    centered,
    contact: [...get('Contact'), ...get('Copyright')],
    draft: [...get('Draft date'), ...get('Date')]
  }
}

/** Title page values can carry emphasis markers; render them plain. */
function stripMarkers(s: string): string {
  return s.replace(/\*+/g, '').replace(/_/g, '')
}
