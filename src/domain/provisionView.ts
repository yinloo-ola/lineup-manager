// Pure assembly for the Provision managers section (spec §7 / ticket #17):
// per-team manager state fed by the seeded manager email (seed v1 guarantees
// one per team — provisioning confirms/activates accounts, it doesn't type
// emails from scratch), the at-a-glance summary, and the correct-an-email
// validation. Pure: no UI, no network.

import { isEmailShape } from './seed'

/** One team's row on the provisioning page. */
export interface ProvisionTeam {
  teamId: string
  teamName: string
  /** Seeded manager email (null only for pre-v1 tournaments). */
  managerEmail: string | null
  /** team_managers row's user (null = no account yet). */
  managerUserId: string | null
  /** The account's first-login flag. */
  mustChangePassword: boolean
}

export type ProvisionState = 'active' | 'must-change-password' | 'not-provisioned'

/** Derive the on-screen state: account + flag → active; account owing the
 *  first-login change → must change password; no account → not provisioned yet. */
export function provisionState(t: ProvisionTeam): ProvisionState {
  if (t.managerUserId == null) return 'not-provisioned'
  return t.mustChangePassword ? 'must-change-password' : 'active'
}

export interface ProvisionSummary {
  total: number
  active: number
  mustChangePassword: number
  notProvisioned: number
  /** True when every team has a manager account (even one still owing its
   *  first password change) — the at-a-glance "complete" signal. */
  allProvisioned: boolean
}

export function provisionSummary(teams: ProvisionTeam[]): ProvisionSummary {
  const counts: Record<ProvisionState, number> = {
    active: 0,
    'must-change-password': 0,
    'not-provisioned': 0
  }
  for (const t of teams) counts[provisionState(t)]++
  return {
    total: teams.length,
    active: counts.active,
    mustChangePassword: counts['must-change-password'],
    notProvisioned: counts['not-provisioned'],
    allProvisioned: counts['not-provisioned'] === 0
  }
}

/**
 * Validate a manager email on the provisioning page — either the seeded value
 * or an admin's correction. `otherEmails` are the OTHER teams' current manager
 * emails (case-folded clash check: one manager has exactly one team).
 */
export function managerEmailError(email: string, otherEmails: string[] = []): string | null {
  const trimmed = email.trim()
  if (trimmed === '') return 'Manager email is required'
  if (!isEmailShape(trimmed)) return 'That does not look like an email address'
  const folded = trimmed.toLowerCase()
  if (otherEmails.some((e) => e.trim().toLowerCase() === folded)) {
    return 'Another team\u2019s manager already uses that email'
  }
  return null
}
