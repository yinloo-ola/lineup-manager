# 17 — Provision managers from seeded emails

**What to build:** The Provision managers section inside the shell (spec §7), fed by the seed. Each team's manager email arrives pre-filled from the import (seed v1 guarantees one per team) — provisioning becomes confirming/activating those accounts, not typing emails. The page shows per-manager state (active · must change password · not provisioned yet) so the admin can see at a glance which teams are ready before the tournament starts. Account creation goes through the existing edge-function pattern (service-role, caller-JWT authorization per `provision-manager`); no secrets in client code.

**Blocked by:** 12 (seeded emails), 13 (shell).

**Status:** ready-for-agent

- [ ] Every team shows its seeded manager email, pre-filled and editable only to correct, not to create from scratch
- [ ] Provisioning activates the account via the existing edge-function pattern; per-manager state visible and accurate (active / must change password / not provisioned yet)
- [ ] A tournament with all teams provisioned is visibly complete at a glance
- [ ] Unit tests for state derivation; provisioning path exercised without any client-held service key
