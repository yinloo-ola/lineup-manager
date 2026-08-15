import { describe, it, expect } from 'vitest'
import {
  managerEmailError,
  provisionState,
  provisionSummary,
  type ProvisionTeam
} from '../provisionView'

// Ticket #17: provisioning from seeded emails. The pure seams are the
// per-manager state derivation (active / must change password / not
// provisioned yet), the at-a-glance summary, and the correct-an-email
// validation (the seed shape, reused).

function team(extras: Partial<ProvisionTeam> = {}): ProvisionTeam {
  return {
    teamId: 't',
    teamName: 'Team',
    managerEmail: 'mgr@example.test',
    managerUserId: null,
    mustChangePassword: false,
    ...extras
  }
}

describe('provisionState', () => {
  it('no manager account → not provisioned yet', () => {
    expect(provisionState(team())).toBe('not-provisioned')
  })

  it('account still carrying the first-login flag → must change password', () => {
    expect(provisionState(team({ managerUserId: 'u1', mustChangePassword: true }))).toBe(
      'must-change-password'
    )
  })

  it('account with the flag cleared → active', () => {
    expect(provisionState(team({ managerUserId: 'u1', mustChangePassword: false }))).toBe('active')
  })
})

describe('provisionSummary', () => {
  it('counts teams by state', () => {
    const summary = provisionSummary([
      team({ teamId: 'a', managerUserId: 'u1' }),
      team({ teamId: 'b', managerUserId: 'u2', mustChangePassword: true }),
      team({ teamId: 'c' })
    ])
    expect(summary.total).toBe(3)
    expect(summary.active).toBe(1)
    expect(summary.mustChangePassword).toBe(1)
    expect(summary.notProvisioned).toBe(1)
  })

  it('allProvisioned only when no team is waiting (accounts may still owe a password change)', () => {
    expect(
      provisionSummary([
        team({ teamId: 'a', managerUserId: 'u1' }),
        team({ teamId: 'b', managerUserId: 'u2', mustChangePassword: true })
      ]).allProvisioned
    ).toBe(true)
    expect(
      provisionSummary([team({ teamId: 'a', managerUserId: 'u1' }), team({ teamId: 'b' })])
        .allProvisioned
    ).toBe(false)
  })

  it('an empty tournament counts as complete at a glance', () => {
    const summary = provisionSummary([])
    expect(summary.allProvisioned).toBe(true)
    expect(summary.total).toBe(0)
  })
})

describe('managerEmailError', () => {
  it('accepts the seeded email unchanged', () => {
    expect(managerEmailError('mgr@example.test')).toBeNull()
  })

  it('rejects an empty or mis-shaped correction', () => {
    expect(managerEmailError('')).toBe('Manager email is required')
    expect(managerEmailError('not-an-email')).toBe('That does not look like an email address')
    expect(managerEmailError('a@b')).toBe('That does not look like an email address')
  })

  it('rejects a correction that clashes with another team\'s manager email (case-folded)', () => {
    expect(
      managerEmailError('mgr@other.test', ['mgr@Other.test'])
    ).toBe('Another team\u2019s manager already uses that email')
    expect(managerEmailError('mgr@example.test', ['other@example.test'])).toBeNull()
  })
})
