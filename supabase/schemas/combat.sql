create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  game_master_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  current_round integer default 1 not null,
  current_turn_index integer default 0 not null,
  combat_status text default 'setup' not null check (combat_status in ('setup', 'active', 'completed')),
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sessions enable row level security;

create policy "Game Masters can manage their own sessions"
  on public.sessions for all
  using (auth.uid() = game_master_id);

create policy "Anyone can view active sessions"
  on public.sessions for select
  using (is_active = true);

create table public.combatants (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  name text not null,
  initiative integer default 0,
  hp_current integer not null,
  hp_max integer not null,
  temp_hp integer not null default 0,
  armor_class integer not null,
  is_player boolean default false,
  conditions jsonb default '[]'::jsonb,
  revealed_traits jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.combatants enable row level security;

create policy "Game Masters can manage combatants in their sessions"
  on public.combatants for all
  using (
    auth.uid() in (
      select game_master_id from public.sessions where id = session_id
    )
  );

create policy "Players can view combatants in active sessions"
  on public.combatants for select
  using (
    session_id in (
      select id from public.sessions where is_active = true
    )
  );

create table public.session_players (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (session_id, player_id)
);

alter table public.session_players enable row level security;

create policy "Game Masters can manage session players"
  on public.session_players for all
  using (
    auth.uid() in (
      select game_master_id from public.sessions where id = session_id
    )
  );

create policy "Players can view their own session memberships"
  on public.session_players for select
  using (auth.uid() = player_id);