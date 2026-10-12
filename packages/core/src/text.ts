/**
 * Fountain files can arrive with Windows (\r\n), old Mac (\r) or Unix (\n)
 * line endings. Everything downstream (parser, pagination) assumes \n only.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** Split normalized text into lines without dropping trailing empty lines. */
export function splitLines(text: string): string[] {
  return normalizeLineEndings(text).split('\n')
}
