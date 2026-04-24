
  create table "public"."session_players" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid not null,
    "player_id" uuid not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."session_players" enable row level security;

alter table "public"."combatants" add column "conditions" jsonb default '[]'::jsonb;

alter table "public"."sessions" add column "combat_status" text not null default 'setup'::text;

alter table "public"."sessions" add column "current_round" integer not null default 1;

alter table "public"."sessions" add column "current_turn_index" integer not null default 0;

CREATE UNIQUE INDEX session_players_pkey ON public.session_players USING btree (id);

CREATE UNIQUE INDEX session_players_session_id_player_id_key ON public.session_players USING btree (session_id, player_id);

alter table "public"."session_players" add constraint "session_players_pkey" PRIMARY KEY using index "session_players_pkey";

alter table "public"."session_players" add constraint "session_players_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."session_players" validate constraint "session_players_player_id_fkey";

alter table "public"."session_players" add constraint "session_players_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE not valid;

alter table "public"."session_players" validate constraint "session_players_session_id_fkey";

alter table "public"."session_players" add constraint "session_players_session_id_player_id_key" UNIQUE using index "session_players_session_id_player_id_key";

alter table "public"."sessions" add constraint "sessions_combat_status_check" CHECK ((combat_status = ANY (ARRAY['setup'::text, 'active'::text, 'completed'::text]))) not valid;

alter table "public"."sessions" validate constraint "sessions_combat_status_check";

grant delete on table "public"."session_players" to "anon";

grant insert on table "public"."session_players" to "anon";

grant references on table "public"."session_players" to "anon";

grant select on table "public"."session_players" to "anon";

grant trigger on table "public"."session_players" to "anon";

grant truncate on table "public"."session_players" to "anon";

grant update on table "public"."session_players" to "anon";

grant delete on table "public"."session_players" to "authenticated";

grant insert on table "public"."session_players" to "authenticated";

grant references on table "public"."session_players" to "authenticated";

grant select on table "public"."session_players" to "authenticated";

grant trigger on table "public"."session_players" to "authenticated";

grant truncate on table "public"."session_players" to "authenticated";

grant update on table "public"."session_players" to "authenticated";

grant delete on table "public"."session_players" to "service_role";

grant insert on table "public"."session_players" to "service_role";

grant references on table "public"."session_players" to "service_role";

grant select on table "public"."session_players" to "service_role";

grant trigger on table "public"."session_players" to "service_role";

grant truncate on table "public"."session_players" to "service_role";

grant update on table "public"."session_players" to "service_role";


  create policy "Game Masters can manage session players"
  on "public"."session_players"
  as permissive
  for all
  to public
using ((auth.uid() IN ( SELECT sessions.game_master_id
   FROM public.sessions
  WHERE (sessions.id = session_players.session_id))));



  create policy "Players can view their own session memberships"
  on "public"."session_players"
  as permissive
  for select
  to public
using ((auth.uid() = player_id));



