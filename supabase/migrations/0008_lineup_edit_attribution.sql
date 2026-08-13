-- Ticket 8: attribute + log lineup edits. A `updated_by` column records who last
-- touched a lineup (admin email or manager email), populated tamper-proof from
-- the request JWT by a BEFORE trigger (a client cannot spoof it). updated_at is
-- also stamped server-side so it reflects the real edit time.

alter table lineups add column if not exists updated_by text;

create or replace function public.set_lineup_audit()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_by := coalesce(auth.jwt() ->> 'email', NEW.updated_by);
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists lineups_set_audit on lineups;
create trigger lineups_set_audit
  before insert or update on lineups
  for each row execute function public.set_lineup_audit();
