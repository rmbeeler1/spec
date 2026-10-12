import type { PdfFonts } from '@spec/core'
import regularUri from '@fonts/courier-prime/CourierPrime-Regular.ttf?inline'
import boldUri from '@fonts/courier-prime/CourierPrime-Bold.ttf?inline'
import italicUri from '@fonts/courier-prime/CourierPrime-Italic.ttf?inline'
import boldItalicUri from '@fonts/courier-prime/CourierPrime-BoldItalic.ttf?inline'

/** Fonts arrive as base64 data URIs so PDF export needs no file access. */
function toBytes(dataUri: string): Uint8Array {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

let cached: PdfFonts | null = null

export function pdfFonts(): PdfFonts {
  cached ??= {
    regular: toBytes(regularUri),
    bold: toBytes(boldUri),
    italic: toBytes(italicUri),
    boldItalic: toBytes(boldItalicUri)
  }
  return cached
}
