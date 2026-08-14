import { describe, it, expect } from 'vitest'
import { renameError } from '../tournamentManage'

// Ticket #15: rename / start-date / delete-tournament management. The one pure
// seam is the rename validation — the same case-folded uniqueness the import path
// enforces (seed a second "spring" vs "Spring" is confusing), plus the empty
// guard. `otherNames` is the names of every OTHER tournament (the one being
// renamed is excluded by the caller), matching the prototype's renError rule.

describe('renameError', () => {
  it('accepts a fresh, non-empty name', () => {
    expect(renameError('Spring Cup 2026', ['Default', 'Winter Cup'])).toBeNull()
  })

  it('trims before checking', () => {
    expect(renameError('  Spring Cup 2026  ', ['Default'])).toBeNull()
  })

  it('rejects an empty / whitespace-only name as required', () => {
    expect(renameError('', ['Default'])).toBe('Name is required')
    expect(renameError('   ', ['Default'])).toBe('Name is required')
  })

  it('rejects a case-insensitive clash with another tournament', () => {
    expect(renameError('default', ['Default'])).toBe(
      'A tournament with that name already exists'
    )
    expect(renameError('DEFAULT', ['Default'])).toBe(
      'A tournament with that name already exists'
    )
    expect(renameError('  winter cup ', ['Summer', 'Winter Cup'])).toBe(
      'A tournament with that name already exists'
    )
  })

  it('allows keeping the current name (caller excludes the renamed tournament)', () => {
    // The caller passes every OTHER name, so the tournament's own name never clashes.
    expect(renameError('Default', ['Winter Cup'])).toBeNull()
  })
})
