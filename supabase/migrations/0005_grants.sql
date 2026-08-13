-- Explicit DML grants on the public tables.
-- Supabase's default privileges did not cover tables created in migrations, so
-- writes hit 42501 — for anon/authenticated (import, format authoring, lineups)
-- AND for service_role (the provision-manager edge function inserts into
-- team_managers). service_role bypasses RLS but still needs table privileges.
-- RLS still gates which rows anon/authenticated can actually touch.

grant select, insert, update, delete
  on table categories, teams, players, ties, app_admins, team_managers, tie_formats, lineups
  to anon, authenticated, service_role;
