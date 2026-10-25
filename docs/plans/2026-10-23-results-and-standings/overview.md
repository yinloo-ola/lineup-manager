# Overview: results-and-standings

Goal: run a real team event end-to-end — umpires/admins record results, standings rank groups with manual ranking, KO brackets complete from results, and the public follows a live read-only page, deployed for real.

## Parts (build order)
1. results-entry — umpire role (provisioned by admin, per-tournament, results-only) + per-tie bestOf (default 5, odd-only admin override) + rubber results with actual players pre-filled from submitted lineups, free-form games, walkovers, and best-of decidedness validation; entry blocked until both sides' lineups are submitted; player changes admin-only.
2. standings — points 2 win / 1 played-loss / 0 walked-over from decided group ties, per group; admin keys manual ranking as a clean 1..n permutation when points tie; per-category qualifier count (default 2) highlights advancing teams.
3. ko-public — a decided KO result derives winner_side and flows through the existing bracket cascade (winner-toggle stays as admin no-show shortcut); public no-login page with results + standings + bracket behind a per-tournament publish toggle (default off) via anon RLS.
4. deploy — GitHub Pages workflow mirroring tournament-manager's deploy.yml, Supabase cloud project wired via secrets, edge functions live.
