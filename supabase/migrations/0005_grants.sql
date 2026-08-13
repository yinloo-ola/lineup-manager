-- Explicit DML grants on the public tables.
-- Supabase's default privileges did not cover tables created in migrations, so
-- signed-in writes (import, format authoring, lineups) hit 42501. RLS still
-- gates which rows each role can actually touch.

grant select, insert, update, delete
  on table categories, teams, players, ties, app_admins, team_managers, tie_formats, lineups
  to anon, authenticated;
