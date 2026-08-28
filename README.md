# 17-0

An original historical NFL team-building draft game spanning the **1970s through
2020s**. You spin for a franchise and a decade, pick one of that team's offensive
skill players, and assign them to an open slot in a six-man I-formation lineup.
A completed offense projects a **17-game** regular-season record.

```text
WR                         WR

             TE

             QB

             FB

             RB
```

The six draft slots are `QB`, `RB`, `FB`, `WR1`, `WR2`, `TE`. `WR1` and `WR2`
are separate slots that both accept a normalized `WR`.

**Phase 1 scope:** database model, draft engine, minimal API. No historical
import, no scoring, no final UI.

## Requirements

- Node 20+
- A PostgreSQL database (Supabase is the intended host; any Postgres works)

## Setup

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL
npm run db:migrate           # or: npm run db:push
npm run db:seed              # small development dataset
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Next.js dev server                             |
| `npm run build`       | Production build                               |
| `npm run typecheck`   | `tsc --noEmit`                                 |
| `npm run lint`        | ESLint                                         |
| `npm test`            | Vitest (game rules + in-process Postgres)      |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:migrate`  | Apply migrations                               |
| `npm run db:push`     | Push the schema directly (dev convenience)     |
| `npm run db:seed`     | Reset and load the development dataset         |

## Architecture

```text
Historical NFL data -> normalization -> PostgreSQL
  -> player/team/era cards -> draft engine -> API -> interface
```

The database and the server-side engine are the only authority on game rules.
The UI may hide illegal options but never decides them.

```text
src/lib/football/    domain vocabulary: positions, slot eligibility, decades
src/lib/game/        pure draft engine (no React, no SQL)
src/db/              Drizzle schema, client, development seed
src/server/          Drizzle implementation of the engine's repository port
src/app/api/game/    HTTP surface
src/app/page.tsx     player-facing game
tests/               engine rules + end-to-end run against real SQL
```

The engine depends on a `GameRepository` port (`src/lib/game/ports.ts`) rather
than on Drizzle. Production binds the Drizzle adapter; tests bind an in-memory
fake, and one suite binds an in-process Postgres (PGlite) so the real SQL,
schema, and seed are covered too.

Two rules are centralized on purpose:

- **Slot eligibility** lives only in `src/lib/football/positions.ts`.
- **Historical position conversion** lives only in
  `src/lib/football/normalizePosition.ts`. Phase 1 maps the unambiguous labels
  (`HB`/`TB` -> `RB`, `FL`/`SE` -> `WR`, ...) and refuses to guess anything
  else, leaving room for manual overrides.

## Tables

`eras`, `franchises`, `franchise_seasons`, `players`, `player_seasons`,
`player_season_positions`, `player_team_era_cards`,
`player_team_era_positions`, `game_sessions`, `game_picks`.

Notes:

- A franchise's identity is its row, never an abbreviation. `franchise_seasons`
  carries the name and abbreviation actually used in a given season, so a
  relocation stays one organization.
- `players.id` is the primary identity; `gsis_id`, `pfr_id`, and `external_id`
  are optional reconciliation keys for future imports.
- Every statistic column is nullable. A missing historical stat is `NULL`, not
  `0`, because unknown and zero are different facts.

## API

| Method | Route                | Body                                              |
| ------ | -------------------- | ------------------------------------------------- |
| `POST` | `/api/game/start`    | —                                                 |
| `POST` | `/api/game/spin`     | `{ sessionId }`                                   |
| `POST` | `/api/game/pick`     | `{ sessionId, playerTeamEraCardId, lineupSlot }`  |
| `GET`  | `/api/game/[id]`     | —                                                 |

A spin never returns a dead end: only franchise/era combinations holding at
least one undrafted player eligible for an open slot are considered, and the
rolled combination is stored on the session so the following pick is validated
against it server-side.

## Development data

`src/db/seed/devData.ts` is **development/testing data only**. The franchises
and eras are real; every player and every statistic is fictional. It remains
available for fast engine tests via `npm run db:seed`.

## Historical data (Phase 2)

Real roster/player history is imported from **nflverse** public GitHub Release
CSV assets (no scraping, no live third-party calls at Spin time). Roster history
may include seasons before 1970 for identity continuity; **playable spins cover
1970s–2020s only**. Pre-1999 season production is enriched from MarcLinder
NFL.com CSV mirrors (1970–1998); 1999+ uses nflverse `player_stats`.

Import cutoff: **2025** (latest completed NFL season configured for this phase).
Recorded in `data/manifests/nflverse.json` when you download.

```bash
npm run data:download   # caches CSVs under .cache/nflverse/ (gitignored)
npm run data:import     # loads into local PGlite, or DATABASE_URL with opt-in
npm run data:build-cards
npm run data:audit      # writes data/reports/coverage-audit.*
npm run data:sanity     # landmark player spot-checks against the imported DB
npm run data:refresh    # download + import + audit
```

`npm run dev` never downloads or imports historical data automatically.

**Destructive import safeguard:** `data:import` and `data:refresh` wipe game
sessions, picks, players, franchises, eras, and related tables before
reloading. Local PGlite (no `DATABASE_URL`) may reset automatically. Against
`DATABASE_URL` / Postgres / Supabase you must set
`ALLOW_DESTRUCTIVE_DATA_IMPORT=1` or the command aborts before deleting
anything.

Draftable threshold (centralized in `src/data/draftable.ts`): a card needs at
least one normalized skill position and participation evidence (`games >= 1`
when stats exist, otherwise `ACT` roster status). Manual position overrides live
in `data/overrides/position-overrides.json` and apply after automatic
normalization.

Franchise abbreviation → lineage mapping is centralized in
`src/data/franchises/aliases.ts` (season-aware for BAL / HOU / STL, etc.).

Runtime sounds live in `public/sounds/` (`spin-tick.mp3`, `reveal-hit.mp3`,
`draft-lock.mp3`, `show-results.mp3`, `jackpot.mp3`). Canonical copies:
https://github.com/Rambo519/17-0
