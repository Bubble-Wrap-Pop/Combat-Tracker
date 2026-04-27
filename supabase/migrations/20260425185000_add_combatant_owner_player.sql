alter table public.combatants
  add column if not exists owner_player_id uuid references public.profiles(id) on delete set null;

drop policy if exists "Players can add their own combatants" on public.combatants;
create policy "Players can add their own combatants"
  on public.combatants for insert
  with check (
    owner_player_id = auth.uid()
    and is_player = true
    and session_id in (
      select session_id from public.session_players where player_id = auth.uid()
    )
  );

drop policy if exists "Players can update their own combatants" on public.combatants;
create policy "Players can update their own combatants"
  on public.combatants for update
  using (owner_player_id = auth.uid())
  with check (owner_player_id = auth.uid());

drop policy if exists "Players can remove their own combatants" on public.combatants;
create policy "Players can remove their own combatants"
  on public.combatants for delete
  using (owner_player_id = auth.uid());
