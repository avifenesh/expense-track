import { describe, expect, it } from 'vitest'
import { normalizeDateInput } from '@/utils/date'

describe('normalizeDateInput', () => {
  it('converts ISO date strings to UTC midnight', () => {
    const parsed = normalizeDateInput('2024-10-01')
    expect(parsed).not.toBeNull()
    expect(parsed?.toISOString()).toBe('2024-10-01T00:00:00.000Z')
  })

  it('returns null for malformed inputs', () => {
    expect(normalizeDateInput('')).toBeNull()
    expect(normalizeDateInput('2024-13-01')).toBeNull()
    expect(normalizeDateInput(null)).toBeNull()
    expect(normalizeDateInput('2024-02-30')).toBeNull()
  })
})
