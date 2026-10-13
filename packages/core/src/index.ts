export { normalizeLineEndings, splitLines } from './text'
export type {
  ElementType,
  Script,
  ScriptElement,
  TitlePageEntry
} from './model/types'
export { randomIdGenerator, sequentialIdGenerator, type IdGenerator } from './model/ids'
export { titlePageBlocks, type TitlePageBlocks } from './model/titlePage'
export { parseFountain, type ParseOptions } from './fountain/parse'
export { serializeFountain } from './fountain/serialize'
export { parseEmphasis, spansForRange, type StyledText, type StyleSpan } from './text/emphasis'
export { DEFAULT_PAGINATION, type PaginationConfig } from './pagination/config'
export {
  paginate,
  wrapLine,
  type RenderLine,
  type RenderLineType,
  type RenderPage
} from './pagination/paginate'
export {
  classifyLines,
  type ClassifiedLine,
  type ClassifiedType,
  type ImportLine
} from './import/classifier'
export { buildScript, extractTitlePage } from './import/build'
export { importPlainText, importMarkdown, type ImportResult } from './import/text'
export { importDocx } from './import/docx'
export { importPdf } from './import/pdf'
export { readFdx, type ReadFdxOptions } from './fdx/read'
export { writeFdx } from './fdx/write'
export { exportPdf, type PdfExportOptions, type PdfFonts } from './pdf/exportPdf'
export {
  attachSceneMeta,
  emptyPlanning,
  isPlanningEmpty,
  parsePlanning,
  serializePlanning,
  sidecarPathFor,
  stashPathFor,
  type AttachResult,
  type BeatCard,
  type BeatLink,
  type PlanningData,
  type SceneMeta,
  type SceneRef,
  type StashEntry,
  type Storyline,
  type WritingDay,
  type WritingGoal,
  type WritingStats
} from './planning/sidecar'
export {
  baseCharacterName,
  buildOutline,
  characterStats,
  parseHeadingInfo,
  sceneCardBody,
  scenePageStats,
  type CharacterStat,
  type HeadingInfo,
  type OutlineNode,
  type ScenePages
} from './planning/stats'
export {
  buildReports,
  headingLocation,
  reportToCsv,
  reportToText,
  type ReportTable
} from './planning/reports'
export {
  nextSceneNumber,
  parseSceneNumber,
  sequentialSceneNumbers,
  type SceneNumberParts
} from './planning/numbering'
export {
  parseStashFile,
  serializeStashFile,
  stashChunkFountain,
  stashChunkSummary,
  type StashChunk
} from './planning/stash'

export const CORE_VERSION = '0.3.2'
