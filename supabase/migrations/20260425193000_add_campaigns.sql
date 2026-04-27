create table if not exists public.campaigns (
  id uuid default gen_random_uuid() primary key,
  game_master_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.campaigns enable row level security;

drop policy if exists "Game Masters can manage their own campaigns" on public.campaigns;
create policy "Game Masters can manage their own campaigns"
  on public.campaigns for all
  using (auth.uid() = game_master_id);

alter table public.sessions
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
