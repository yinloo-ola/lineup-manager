# 07 · Prototype: bracket view, dashboard rows, and lineup builder

Type: prototype
Status: resolved
Blocked by: 04, 06

## Question

Behavior is decided ([06](06-tbd-ux.md)); raise fidelity with a cheap concrete artifact before spec-writing: rough UI takes (via `/prototype`) of the **round-grouped bracket view** (the module's home — first-round pickers, winner selection, cascade confirmation, bye rows), **Matches dashboard rows** with TBD sides and KO links, and the **lineup builder** with a "vs TBD" opponent — in lineup-manager's Vuetify visual language. React to it; the reaction may adjust 06's decisions. The prototype is linked as an asset, not pasted in.

## Comments

- Prototype: [`prototype/ko-import-bracket.html`](../../../prototype/ko-import-bracket.html) (untracked throwaway; self-contained — vendored Vue/Vuetify/MDI under `prototype/vendor/`, double-click or `python3 -m http.server` to view). Verified working: variant switching, winner propagation, bye advance, cascade dialog.
- 2026-08-19 user reaction + fixes applied: (1) Variant C crashed on render (v-table + `v-for` on `<tr>` inside an in-DOM template — the HTML parser mangles table markup in unknown components before Vue compiles it); replaced with a plain HTML table. (2) **Variant A had no undo for a wrongly-clicked winner** — added the cascade pencil to decided match cards (the correction path from 05, consistent with B). (3) **Variant C could not pick the side-B winner at all** — mock flaw; now both team names are compact pick buttons; also noted C's density cramps winner selection + correction affordances (a point against C). (4) Fidelity: bye ties now accept exactly one team (05's guardrail), and variant A's winner buttons now unlock only when both sides are set (05's rule). Verdict on the winning variant still awaited.
- 2026-08-19 user reaction (major model change) — **first-round placement model**: first-round slots ALL start empty; the import brings the bracket structure plus a **pool of scheduled matches** (table+time) whose count already accounts for byes (6 qualifiers → 2 scheduled QF matches, 2×2+2×1=6 — "only 2 matches in this QF"); the admin **enters teams onto slots AND places each imported match** on a two-team slot (user example: matches at QF2/QF3, byes at QF1/QF4 forwarding to the next round). Prototype rewritten to this model (all variants): imported-pool banner, assign-select on two-team slots, bye-pending state, balance rule (two-team slots = imported matches, every slot ≥1 team), "Advance byes" once balanced, winner pick requires a placed match. Flow verified end-to-end in-browser (placement at QF1/QF3 byes at QF2/QF4 → feeds followed positions). Encoded by judgment, awaiting confirmation: byes advance on round balance (not on entry); winner selection requires a placed schedule. This reaction amends 03/04/05/06 — see their comments.
- 2026-08-19 user clarification — scope of the placement model: it applies to the **first round of the knockout stage** (the qualifiers' entry round — R256/R128/R64/R32/R16/QF depending on draw size; QF only because the mock's 6-team example draws an 8-bracket). Group-stage matches arrive complete at import; later KO rounds stay positional, scheduled, and fed. The prototype and ticket amendments already assume this scope; recorded to remove the "first round" ambiguity.
- 2026-08-19 user reaction — **un-pick via the selected control**: "can we just click the selected tick again?" Yes — implemented as a toggle across all variants: clicking the selected winner un-picks it — **instantly** when nothing downstream moved, or through the **cascade confirmation** when it has (filled fed side, later winner, lineup); the non-winning button is disabled while decided; the now-redundant cascade pencils were removed. Verified in-browser: un-pick with downstream opens the dialog (cancel preserves, confirm rewinds the fed side). Semantics unchanged (05's cascade-clear stands) — this is the entry point.
- 2026-08-19 user reaction — **un-entering a team**: "after selecting a team, how to unselect it?" The mock had no affordance; added a small **✕** beside each entered first-round team: instant removal when the slot has no winner (decided slots un-pick the winner first, per the cascade path), and **clearing one side of a placed match releases the imported-match placement back to the pool** (banner chip unbinds, slot may degrade to bye-pending). Verified in-browser both paths. Semantic recorded on 05.
- 2026-08-19 — **verdict: "Variant C I choose"** — the grouped table wins.

## Answer

Resolved 2026-08-19 — the user's verdict after hands-on reaction (remote session, live prototype): **Variant C — the grouped table**.

The winning form, as iterated during the reaction: one dense table per category, rounds as group headers, one row per bracket slot — side cells (entered team, or entry picker + **✕** removal), a winner/assignment cell (assign-imported-match select on unplaced two-team slots; both-team buttons once placed, the selected winner toggling to un-pick — instantly or through the cascade confirmation when downstream moved), a meta cell (placed table · time, BYE, or —), the imported-pool banner above (chips bind to slots on placement and unbind on release), the advance-byes action on round balance, and the cascade dialog.

Reaction-driven changes folded in along the way (full history in Comments): the v-table crash fix (plain table), both-side winner buttons, winner-toggle un-pick (pencils removed), ✕ un-enter with placement release, winner-unlock gating on placement.

The two judgment calls flagged during the placement-model rewrite — byes advance on round balance; winner selection requires a placed match — stood unchallenged through the user's hands-on session; carried into the spec as-is, flippable at assembly.

Asset: `prototype/ko-import-bracket.html` (untracked throwaway, vendored deps — the primary source for the winning layout; stays uncommitted per repo convention, the spec encodes the validated design).
