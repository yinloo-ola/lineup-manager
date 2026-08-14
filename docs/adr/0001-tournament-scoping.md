---
status: accepted
---
# Tournament scoping & lifecycle

We introduced a `tournaments` table and made every team, category, tie, tie format,
lineup, and team manager belong to exactly one tournament, so the app runs many
tournaments concurrently in a single deployment. A team belongs to exactly one
tournament (the same club in a later tournament is a distinct team row); every seed
import creates a new tournament; deleting a tournament hard-cascades and also removes
its provisioned managers' auth accounts.

## Considered options

- **Team per tournament (chosen)** vs. team-as-global-entity spanning tournaments via a
  join table. Chosen per-tournament because managers are already 1:1 with a team, so a
  manager is automatically scoped to their one tournament and needs no selector;
  spanning would force a selector on managers and complicate RLS.
- **Upload = new tournament (chosen)** vs. upsert/append into an existing tournament.
  Chosen because tournament data is fixture-shaped and ids only need to be unique within
  a tournament (composite `(tournament_id, id)`); append/upsert was rejected to keep
  import semantics simple and collision-free.
- **Delete clears auth.users (chosen)** vs. block-delete-if-managers / leave orphaned.
  Chosen to avoid login-to-an-empty-app orphans; implemented via a service-role edge
  function mirroring the existing `provision-manager` flow.

## Consequences

- Re-uploading the same seed file creates a *second* tournament (by design) — there is
  no in-place update; correct a bad import by deleting and re-uploading.
- Deleting a tournament is irreversible and deletes real user accounts; the UI
  double-confirms and enumerates the consequences (incl. manager accounts cleared).
- `tie_formats` uniqueness widens to `(tournament_id, category_id)`; `tournaments.start_date`
  anchors the `asOf:'tournament-start'` age check (previously it misused each tie's own date).
