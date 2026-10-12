export type IdGenerator = () => string

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Random 10-character IDs. Collision odds are negligible at script scale. */
export function randomIdGenerator(): IdGenerator {
  return () => {
    const bytes = new Uint8Array(10)
    globalThis.crypto.getRandomValues(bytes)
    let id = ''
    for (const b of bytes) id += ALPHABET[b % ALPHABET.length]
    return id
  }
}

/** Predictable IDs (e1, e2, ...) so tests and snapshots stay stable. */
export function sequentialIdGenerator(prefix = 'e'): IdGenerator {
  let n = 0
  return () => `${prefix}${++n}`
}
