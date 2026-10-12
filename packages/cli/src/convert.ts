import { readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import {
  exportPdf,
  importDocx,
  importMarkdown,
  importPlainText,
  parseFountain,
  readFdx,
  serializeFountain,
  writeFdx,
  type PdfFonts,
  type Script
} from '@spec/core'

export interface ConvertDeps {
  fonts: PdfFonts
}

const READABLE = ['.fountain', '.txt', '.md', '.docx', '.fdx']
const WRITABLE = ['.fountain', '.fdx', '.pdf']

/** Convert between formats, routed by file extension. */
export async function convertFile(input: string, output: string, deps: ConvertDeps): Promise<void> {
  const from = extname(input).toLowerCase()
  const to = extname(output).toLowerCase()
  if (!READABLE.includes(from)) {
    throw new Error(`Cannot read ${from || 'files without an extension'}. Readable: ${READABLE.join(', ')}`)
  }
  if (!WRITABLE.includes(to)) {
    throw new Error(`Cannot write ${to || 'files without an extension'}. Writable: ${WRITABLE.join(', ')}`)
  }

  let script: Script
  if (from === '.docx') {
    script = importDocx(await readFile(input)).script
  } else {
    const source = await readFile(input, 'utf8')
    if (from === '.fdx') script = readFdx(source)
    else if (from === '.txt') script = importPlainText(source).script
    else if (from === '.md') script = importMarkdown(source).script
    else script = parseFountain(source)
  }

  if (to === '.pdf') {
    await writeFile(output, await exportPdf(script, { fonts: deps.fonts }))
  } else if (to === '.fdx') {
    await writeFile(output, writeFdx(script), 'utf8')
  } else {
    await writeFile(output, serializeFountain(script), 'utf8')
  }
}
