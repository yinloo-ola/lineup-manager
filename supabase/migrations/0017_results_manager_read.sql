-- 0017: managers can READ the results of their own tournament's team matches
-- (results-and-standings slice 1, R3). Read-only: no insert/update policy is
-- granted — a manager's write attempt stays denied. The manager's tournament
-- comes from their team via manager_tournament_id() (migration 0010).

create policy "manager reads own tournament results" on rubber_results
  for select to authenticated
  using (tournament_id = public.manager_tournament_id());
