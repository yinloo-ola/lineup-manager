-- Ticket 6: managers may save and update their own team's lineup drafts.
-- Reads were granted in 0004 ("manager reads own lineups"); this adds the
-- insert + update policies so a manager can persist a draft for their team only.
-- (PK is (tie_id, team_id), so an upsert lands on the manager's own row.)

create policy "manager inserts own lineups" on lineups
  for insert to authenticated with check (team_id = public.manager_team_id());

create policy "manager updates own lineups" on lineups
  for update to authenticated
  using (team_id = public.manager_team_id())
  with check (team_id = public.manager_team_id());
