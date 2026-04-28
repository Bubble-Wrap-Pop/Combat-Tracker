# Combat Tracker

A synchronized tabletop combat and initiative tracker built on **Next.js 16**, **React 19**, **Supabase**, and **Tailwind CSS v4**. Game masters run encounters from a GM dashboard; players join sessions, see live turn order, and edit their own characters. Row Level Security keeps data scoped to the right users.

Originally extended from a Next.js + Supabase starter (auth, profiles, avatars) by Braden Cannon.

## Features

- **Authentication** — Email sign-up / sign-in, cookie-based sessions via `@supabase/ssr`, protected routes.
- **Combat sessions** — GMs create sessions; `sessions` stores round, turn index, and status.
- **Combatants** — HP (including temp HP before regular HP on damage), AC, initiative, conditions, optional JSON resources (short/long rest recharge rules).
- **Realtime** — `useCombatSession` subscribes to Postgres changes on `sessions` and `combatants` so GM and player UIs stay in sync.
- **Player lobby** — Join via link or ID; membership list can update over Realtime.
- **Mock AI monster generator** — `POST /api/generate-monster` simulates a short delay and returns random name, HP, initiative, and AC; the GM dashboard can insert the result as a combatant. (Commented hook point for Vercel AI SDK `generateObject` later.)
- **Inngest** — `POST/GET/PUT /api/inngest` registers functions. A daily cron job deletes `sessions` rows older than 24 hours using the **Supabase service role** (cascades to `combatants` and `session_players`).

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm**
- **Docker Desktop** (for local Supabase)
- **Supabase CLI** (`npm i -g supabase` or use `npx`)

## Quick start

1. Start **Docker Desktop**.
2. From the project root:
   ```bash
   node setup.js
   ```
   This installs dependencies, starts Supabase when possible, and writes `.env.local` with local API URL and anon key when discovery succeeds.
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Manual setup

1. `npm install`
2. `npx supabase start`
3. Create **`.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=<from supabase status>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
   ```
4. `npx supabase db reset` (applies migrations)
5. `npm run dev`

### Local Inngest dev

For the Inngest dev server to discover your app, you can set:

```env
INNGEST_DEV=1
```

Run the [Inngest CLI dev command](https://www.inngest.com/docs/local-development) alongside `npm run dev` when testing scheduled functions locally.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint (`eslint .` + Next config) |
| `npm run test` | Jest test suite |
| `npm run test:watch` | Jest in watch mode |

## Project structure (high level)

| Path | Purpose |
|------|---------|
| `app/` | App Router routes, layouts, `api/` routes (`inngest`, `generate-monster`, …) |
| `components/combat/` | GM dashboard, player views, lobby, hooks (`useCombatSession`) |
| `components/ui/` | Shared UI (shadcn-style) |
| `components/auth/` | Auth forms |
| `lib/combat*.ts` | Pure rules (initiative, HP, conditions, resources) |
| `lib/combatSupabase.ts` | Typed Supabase mutations for combat (damage, heals, resource saves) |
| `lib/inngest/` | Inngest client + scheduled cleanup function |
| `utils/supabase/` | `createSupabaseClient` (browser), `createSupabaseServerClient` (server/cookies) |
| `supabase/migrations/` | Ordered SQL migrations |
| `supabase/schemas/` | Reference schema snippets (e.g. `combat.sql`, `_profiles.sql`) |
| `proxy.ts` | Next.js proxy: refreshes Supabase auth cookies on navigation |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key (browser + server with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | For Inngest cleanup | **Server only.** Bypasses RLS for the daily stale-session delete job |
| `INNGEST_DEV` | Local optional | e.g. `1` to point the SDK at the local Inngest dev server |

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client or commit it to git.

## Database (overview)

- **`profiles`** — User display data; linked to `auth.users`; avatars in Storage.
- **`sessions`** — Combat session: GM, name, round, turn index, status, `created_at` (used by retention cleanup).
- **`combatants`** — Creatures/PCs: HP, temp HP, AC, initiative, resources JSON, conditions, optional `owner_player_id` for player-controlled rows.
- **`session_players`** — Which users joined which session.
- **`campaigns`** — Optional grouping for sessions (see migrations).

RLS policies restrict reads/writes to GMs and players as appropriate. Use migrations as the source of truth for columns and policies.

## Testing

Tests use **Jest** and **React Testing Library**; files use `*.test.ts` / `*.test.tsx` next to sources.

```bash
npm run test
```

## Deployment (e.g. Vercel)

1. Create a Supabase project and run migrations against it (or use linked CI).
2. Set **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** on the host.
3. Set **`SUPABASE_SERVICE_ROLE_KEY`** for production if you rely on the Inngest cleanup job.
4. Configure **Inngest Cloud** with your deployed **`/api/inngest`** URL and signing keys per [Inngest docs](https://www.inngest.com/docs).
5. In Supabase **Authentication → URL configuration**, set the site URL to your production domain.

## GitHub Actions

If `.github/workflows/supabase-migrations.yml` is present, add repository secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`) so pushes can apply migrations remotely.

## Troubleshooting

- **Docker / Supabase won’t start** — Ensure Docker Desktop is running; free ports used by Supabase (often **54321** for API, **54322** for DB—see `npx supabase status`).
- **Blank data / auth errors** — Confirm `.env.local` matches `npx supabase status` for local dev.
- **Realtime quiet** — In the Supabase dashboard, enable replication for `sessions`, `combatants`, and `session_players` if tables were added without publication.
- **Inngest functions not firing in prod** — Verify the app URL, signing key, and that `SUPABASE_SERVICE_ROLE_KEY` is set where the function runs.

## Using this repo for a new project

1. Clone the repository.
2. Optionally remove `.git` and `git init` for a clean history.
3. Run `node setup.js` (or manual steps above).
4. Adapt `app/` routes and branding; keep or replace combat schema as needed.
