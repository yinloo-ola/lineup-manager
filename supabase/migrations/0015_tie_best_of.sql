-- 0015: per-tie best-of-games setting (results-and-standings slice 1, R1).
--
-- Every tie carries its own best_of (games per rubber), defaulting to 5 — the
-- table-tennis standard — so imported and existing ties need no backfill. The
-- admin may override per tie; the check constraint makes even/non-positive
-- values impossible server-side (mirroring the domain's parseBestOf rule).

alter table public.ties
  add column best_of integer not null default 5
  check (best_of > 0 and best_of % 2 = 1);
