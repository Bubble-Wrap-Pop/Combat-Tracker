alter table public.combatants
  add column if not exists ac_visible_to_players boolean not null default false;
