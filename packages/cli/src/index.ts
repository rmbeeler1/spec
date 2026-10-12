import { convertFile } from './convert'
import { bundledFonts } from './fonts'

const USAGE = `spec: screenplay file converter

Usage:
  spec convert <input> <output>

Formats are chosen by file extension:
  read:  .fountain .txt .fdx
  write: .fountain .fdx .pdf

Examples:
  spec convert script.fountain script.pdf
  spec convert script.fountain script.fdx
  spec convert script.fdx script.fountain
`

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args[0] === '--help' || args[0] === '-h' || args.length === 0) {
    process.stdout.write(USAGE)
    return
  }
  const rest = args[0] === 'convert' ? args.slice(1) : args
  if (rest.length !== 2) {
    process.stderr.write(USAGE)
    process.exitCode = 2
    return
  }
  const [input, output] = rest as [string, string]
  await convertFile(input, output, { fonts: bundledFonts })
  process.stdout.write(`Wrote ${output}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
