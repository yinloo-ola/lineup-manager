import { describe, it, expect } from 'vitest'
import { deleteReady, editUnchanged, renameError } from '../tournamentManage'

// Ticket #15: rename / start-date / delete-tournament management. The pure
// seams are the rename validation (the case-folded uniqueness the import path
// enforces, plus the empty guard — `otherNames` excludes the renamed tournament)
// and the dialog gates for the selected-tournament settings page: the edit-save
// "nothing changed" rule and the delete double-confirm.

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

describe('editUnchanged', () => {
  const current = { name: 'Spring Cup', startDate: '2026-03-20' }

  it('true when both the name and the start date are unchanged', () => {
    expect(editUnchanged(current, { name: 'Spring Cup', startDate: '2026-03-20' })).toBe(true)
  })

  it('false when either the name or the start date differs', () => {
    expect(editUnchanged(current, { name: 'Spring Cup 2026', startDate: '2026-03-20' })).toBe(false)
    expect(editUnchanged(current, { name: 'Spring Cup', startDate: '2026-03-21' })).toBe(false)
  })

  it('treats an empty date as "no start date" (null on the stored tournament)', () => {
    expect(editUnchanged({ name: 'Spring Cup', startDate: null }, { name: 'Spring Cup', startDate: '' })).toBe(true)
    expect(editUnchanged({ name: 'Spring Cup', startDate: '2026-03-20' }, { name: 'Spring Cup', startDate: '' })).toBe(false)
  })

  it('compares the name trimmed (surrounding whitespace is not a change)', () => {
    expect(editUnchanged(current, { name: '  Spring Cup  ', startDate: '2026-03-20' })).toBe(true)
  })
})

describe('deleteReady', () => {
  it('requires both the acknowledgement and a literal name match', () => {
    expect(deleteReady('Spring Cup', true, 'Spring Cup')).toBe(true)
    expect(deleteReady('Spring Cup', false, 'Spring Cup')).toBe(false)
    expect(deleteReady('spring cup', true, 'Spring Cup')).toBe(false)
    expect(deleteReady('', true, 'Spring Cup')).toBe(false)
  })
})
