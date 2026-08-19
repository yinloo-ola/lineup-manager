# 05 · Fill-in mechanism: the bracket module (first-round entry + winner propagation)

Type: grilling
Status: resolved
Blocked by: 03, 04

## Question

Decided in [02](02-producer-resolution-workflow.md) and refined by the user (2026-08-18): no resolution in tournament-manager; in lineup-manager the admin enters the **first knockout round's** Teams per match, and every later round fills by **propagation** — a two-team match's selected winner advances; a match with only one team advances that team directly ("for now simply select the winner"; full results key-in is the future extension). This ticket decides the module's details:

- **The one-team rule, sharpened by [03](03-seed-contract-v2.md)**: a first-round bye tie (no time/table) auto-advances its lone team as soon as it's entered; a later-round side that is fed must WAIT for its feeder's winner. Details: does auto-advance happen on entry or need confirmation? Can the admin enter a team on a bye tie's empty side by mistake (guardrail)?
- First-round entry: where the per-match team pickers live in the Matches dashboard; can a team from the wrong event be picked? Can an entry be cleared?
- Winner selection: who may set it (admin only?), when a match becomes selectable (both teams present), and changing/un-selecting a winner **after the next round has filled or a lineup was submitted** — the correction cascade (supersedes the map's correction-conflict fog). Storage settled in [04](04-tbd-sides-data-model.md): `winner_side`, so a side correction makes the old winner meaningless — a re-pick must be forced.
- What a lone-team / no-contest team match means for lineups: does its team's manager ever submit one? (display side lives in [06](06-tbd-ux.md))
- The seed is **one-shot** (decided, 02): no re-import updates; corrections before any lineups exist = delete tournament + re-import; time/table moves after import are out of scope.

## Answer

Resolved 2026-08-18, grilling with the user.

- **Bye ties advance instantly on entry** (recommended, accepted): placing the lone team writes `winner_side` and fills the fed slot in the next round in the same action — no confirmation step; a bye has one possible outcome. A bye tie accepts exactly **one** team; a second entry is blocked (there is no schedule to play on).
- **Corrections cascade-clear** (user pick, over the recommended block-if-downstream): re-picking a winner, or clearing/replacing a first-round entry, rewinds the bracket — downstream `winner_side`s clear and fed sides return to pending. One deliberate-safety valve: the action runs from a **confirmation that enumerates the blast radius** (which winners, sides, and submissions will be wiped) before anything is destroyed.
  - Lineup handling under a cascade: lineups are opponent-agnostic, so a submitted lineup **stands** when its team remains on the tie; when a side that had a submitted lineup is cleared, that lineup is **removed with the side** (named in the confirmation). No new lineup status is introduced — CONTEXT.md's Lineup Status language is untouched.
- **Tight guardrails** (recommended, accepted): first-round pickers offer only same-category teams; a team holds at most one KO slot per category; winner selection is admin-only, enabled once both sides are set; clearing an entry follows the cascade rule above. Managers never select winners.
- Settled by design (no fork): transient one-side-known ties are normal (sides enter/fill independently), and lineup submission is never gated on the opponent — the write path is opponent-agnostic and the cutoff is per-side (04).

Spec notes for [08](08-spec-assembly.md): propagation is atomic — one transaction per entry/advance/correction (a winner pick writes `winner_side` and the fed side together); the cascade-clear confirmation belongs to the admin UX ([06](06-tbd-ux.md)); e2e coverage — bye advance on entry, feed fill, cascade-clear with a submitted lineup standing vs removed, one-slot-per-team violation, same-category picker scoping.

## Comments

- 2026-08-19 (user, via the prototype ticket) — **amendments from the first-round placement model** (see [03](03-seed-contract-v2.md)): (1) "byes advance instantly on entry" is **superseded** — a lone team is provisional (its slot could still receive a second team); byes advance when the **round balances**: every imported match placed, two-team slots = imported matches, every slot ≥1 team. (2) New admin action: **place an imported scheduled match onto a two-team slot** (binding its table+time). (3) Winner selection requires a **placed** match in the first round (extends "both sides set"). Prototype implements all three; balance-trigger timing encoded by judgment, awaiting user confirmation.
- 2026-08-19 (user reaction, prototype) — **un-entering a team** is a first-class correction: removing a team from an undecided slot is instant; a decided slot un-picks its winner first (cascade path); and **clearing one side of a placed match releases the placement** — the imported match returns to the unplaced pool and the slot may degrade to bye-pending. Winner un-pick is a **toggle** (click the selected control again): instant when nothing downstream moved, cascade confirmation when it has.
