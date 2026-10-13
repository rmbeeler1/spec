/**
 * The fixed scene and beat card palette. Stored in the sidecar by name, so a
 * future theme can restyle without touching anyone's data. Values are tuned
 * to read on both the light and dark chrome surfaces.
 */
export const CARD_COLORS: Array<{ name: string; value: string }> = [
  { name: 'red', value: '#c44536' },
  { name: 'orange', value: '#ce6a28' },
  { name: 'yellow', value: '#a8891c' },
  { name: 'green', value: '#3d8a4e' },
  { name: 'teal', value: '#2b8a84' },
  { name: 'blue', value: '#3d6fa8' },
  { name: 'purple', value: '#8456a8' },
  { name: 'gray', value: '#7d7d74' }
]

export function colorValue(name: string | undefined): string | null {
  if (!name) return null
  return CARD_COLORS.find((c) => c.name === name)?.value ?? null
}

/** Pick a color for the next storyline, cycling the palette by count. */
export function nextStorylineColor(existingCount: number): string {
  return CARD_COLORS[existingCount % CARD_COLORS.length]!.name
}
