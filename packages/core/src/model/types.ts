/**
 * The document model. A Script is a flat list of elements, in script order.
 * Fountain text on disk is the source of truth; this model is what the app,
 * the paginator and the exporters work with in memory.
 */

export type ElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'shot' // FDX import only; Fountain has no shot element
  | 'lyric'
  | 'centered'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'boneyard'
  | 'page_break'

export interface ScriptElement {
  /** Stable ID. Planning data in project.json keys off this. */
  id: string
  type: ElementType
  /**
   * Element text with Fountain inline syntax preserved: *italic*, **bold**,
   * _underline_ and inline [[notes]] stay in here verbatim. Multi-line
   * elements (action, dialogue) join their lines with \n.
   */
  text: string
  /** scene_heading only: the number between #...# markers, e.g. "1" or "1A". */
  sceneNumber?: string
  /** section only: heading depth, 1 for #, 2 for ##, and so on. */
  depth?: number
  /** character only: true when this cue had a ^ (right side of dual dialogue). */
  dual?: boolean
  /** true when the element was forced with a prefix (. ! @ > ~). */
  forced?: boolean
}

export interface TitlePageEntry {
  key: string
  values: string[]
}

export interface Script {
  titlePage: TitlePageEntry[]
  elements: ScriptElement[]
}
