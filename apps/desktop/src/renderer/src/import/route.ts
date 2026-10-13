import {
  importDocx,
  importMarkdown,
  importPdf,
  importPlainText,
  readFdx,
  serializeFountain,
  type ClassifiedLine,
  type TitlePageEntry
} from '@spec/core'

export interface PendingImport {
  fileName: string
  lines: ClassifiedLine[]
  titlePage: TitlePageEntry[]
}

export type RoutedImport =
  | { kind: 'direct'; content: string }
  | { kind: 'review'; pending: PendingImport }

/**
 * Route an imported file by extension. Fountain and FDX carry explicit
 * element types and load directly; everything else goes through the
 * classifier and the review pane.
 */
export async function routeImport(path: string, data: Uint8Array): Promise<RoutedImport> {
  const fileName = path.split(/[/\\]/).pop() ?? path
  const ext = (fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '').toLowerCase()
  const decode = (): string => new TextDecoder('utf-8').decode(data)

  switch (ext) {
    case '.fountain':
      return { kind: 'direct', content: decode() }
    case '.fdx':
      return { kind: 'direct', content: serializeFountain(readFdx(decode())) }
    case '.docx': {
      const result = importDocx(data)
      return { kind: 'review', pending: { fileName, lines: result.lines, titlePage: result.script.titlePage } }
    }
    case '.pdf': {
      const result = await importPdf(data)
      return { kind: 'review', pending: { fileName, lines: result.lines, titlePage: result.script.titlePage } }
    }
    case '.md': {
      const result = importMarkdown(decode())
      return { kind: 'review', pending: { fileName, lines: result.lines, titlePage: result.script.titlePage } }
    }
    case '.txt': {
      const result = importPlainText(decode())
      return { kind: 'review', pending: { fileName, lines: result.lines, titlePage: result.script.titlePage } }
    }
    default:
      throw new Error(`Cannot import ${ext || 'files without an extension'}. Supported: .fountain .fdx .docx .pdf .txt .md`)
  }
}
