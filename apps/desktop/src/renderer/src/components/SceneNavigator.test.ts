import { describe, expect, it } from 'vitest'
import { clampNavWidth } from './SceneNavigator'

describe('clampNavWidth', () => {
  it('keeps widths inside the allowed range', () => {
    expect(clampNavWidth(250)).toBe(250)
  })

  it('clamps below the minimum and above the maximum', () => {
    expect(clampNavWidth(0)).toBe(170)
    expect(clampNavWidth(9999)).toBe(460)
  })

  it('falls back to the default for garbage stored values', () => {
    expect(clampNavWidth(Number('not a number'))).toBe(250)
  })
})
