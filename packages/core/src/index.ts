export { normalizeLineEndings, splitLines } from './text'
export type {
  ElementType,
  Script,
  ScriptElement,
  TitlePageEntry
} from './model/types'
export { randomIdGenerator, sequentialIdGenerator, type IdGenerator } from './model/ids'
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

export const CORE_VERSION = '0.1.0'
