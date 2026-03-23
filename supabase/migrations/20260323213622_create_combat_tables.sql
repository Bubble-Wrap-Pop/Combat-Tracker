
  create table "public"."combatants" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid not null,
    "name" text not null,
    "initiative" integer default 0,
    "hp_current" integer not null,
    "hp_max" integer not null,
    "armor_class" integer not null,
    "is_player" boolean default false,
    "revealed_traits" jsonb default '[]'::jsonb,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."combatants" enable row level security;


  create table "public"."sessions" (
    "id" uuid not null default gen_random_uuid(),
    "game_master_id" uuid not null,
    "name" text not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."sessions" enable row level security;

CREATE UNIQUE INDEX combatants_pkey ON public.combatants USING btree (id);

CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id);

alter table "public"."combatants" add constraint "combatants_pkey" PRIMARY KEY using index "combatants_pkey";

alter table "public"."sessions" add constraint "sessions_pkey" PRIMARY KEY using index "sessions_pkey";

alter table "public"."combatants" add constraint "combatants_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE not valid;

alter table "public"."combatants" validate constraint "combatants_session_id_fkey";

alter table "public"."sessions" add constraint "sessions_game_master_id_fkey" FOREIGN KEY (game_master_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."sessions" validate constraint "sessions_game_master_id_fkey";

grant delete on table "public"."combatants" to "anon";

grant insert on table "public"."combatants" to "anon";

grant references on table "public"."combatants" to "anon";

grant select on table "public"."combatants" to "anon";

grant trigger on table "public"."combatants" to "anon";

grant truncate on table "public"."combatants" to "anon";

grant update on table "public"."combatants" to "anon";

grant delete on table "public"."combatants" to "authenticated";

grant insert on table "public"."combatants" to "authenticated";

grant references on table "public"."combatants" to "authenticated";

grant select on table "public"."combatants" to "authenticated";

grant trigger on table "public"."combatants" to "authenticated";

grant truncate on table "public"."combatants" to "authenticated";

grant update on table "public"."combatants" to "authenticated";

grant delete on table "public"."combatants" to "service_role";

grant insert on table "public"."combatants" to "service_role";

grant references on table "public"."combatants" to "service_role";

grant select on table "public"."combatants" to "service_role";

grant trigger on table "public"."combatants" to "service_role";

grant truncate on table "public"."combatants" to "service_role";

grant update on table "public"."combatants" to "service_role";

grant delete on table "public"."sessions" to "anon";

grant insert on table "public"."sessions" to "anon";

grant references on table "public"."sessions" to "anon";

grant select on table "public"."sessions" to "anon";

grant trigger on table "public"."sessions" to "anon";

grant truncate on table "public"."sessions" to "anon";

grant update on table "public"."sessions" to "anon";

grant delete on table "public"."sessions" to "authenticated";

grant insert on table "public"."sessions" to "authenticated";

grant references on table "public"."sessions" to "authenticated";

grant select on table "public"."sessions" to "authenticated";

grant trigger on table "public"."sessions" to "authenticated";

grant truncate on table "public"."sessions" to "authenticated";

grant update on table "public"."sessions" to "authenticated";

grant delete on table "public"."sessions" to "service_role";

grant insert on table "public"."sessions" to "service_role";

grant references on table "public"."sessions" to "service_role";

grant select on table "public"."sessions" to "service_role";

grant trigger on table "public"."sessions" to "service_role";

grant truncate on table "public"."sessions" to "service_role";

grant update on table "public"."sessions" to "service_role";


  create policy "Game Masters can manage combatants in their sessions"
  on "public"."combatants"
  as permissive
  for all
  to public
using ((auth.uid() IN ( SELECT sessions.game_master_id
   FROM public.sessions
  WHERE (sessions.id = combatants.session_id))));



  create policy "Players can view combatants in active sessions"
  on "public"."combatants"
  as permissive
  for select
  to public
using ((session_id IN ( SELECT sessions.id
   FROM public.sessions
  WHERE (sessions.is_active = true))));



  create policy "Anyone can view active sessions"
  on "public"."sessions"
  as permissive
  for select
  to public
using ((is_active = true));



  create policy "Game Masters can manage their own sessions"
  on "public"."sessions"
  as permissive
  for all
  to public
using ((auth.uid() = game_master_id));



