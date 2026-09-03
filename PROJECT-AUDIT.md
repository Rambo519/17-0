# 17-0 project audit

Inspection-only. Written 2026-09-03 from the files on disk. Nothing was run, built, rebuilt, simulated, committed, pushed, or connected to a remote service. Local PGlite was not opened. Row counts below come from already-written audit JSON and committed snapshots, not a live query.

Working tree inspected: `E:\Dev\17-0`. Sibling worktree `E:\Dev\17-0-telemetry` was listed, not mixed in.

---

## 1. Repository

### Remote, branches, HEAD

| Item | Value |
|---|---|
| Origin | `https://github.com/Rambo519/17-0.git` (fetch and push) |
| GitHub default (`origin/HEAD`) | **`main`** at `c92a769` — commit message “Add files via upload” (2026-08-25). Unrelated history to `master`. |
| Local current branch | **`master`** |
| HEAD (both worktrees) | `9bf72f03a2c0ad85655906fd7640c16631c4e0cc` |
| HEAD subject | Add 17-0 celebration and rebalance audio volume |
| HEAD date | 2026-08-30 23:26:16 -0400 |
| Author | Rambo519 `<nothingiwant12@gmail.com>` |
| Tracks | `origin/master` (also `9bf72f03`) |
| Ahead of origin/master? | No extra **commits**. All scoring-lock, telemetry, and audit work is uncommitted. |

`origin/master` and `origin/main` do not share a merge-base in this clone. They are disjoint histories. All real product commits live on `master`.

### Local branches and worktrees

| Path | Branch | Tracks | HEAD | What it is |
|---|---|---|---|---|
| `E:\Dev\17-0` | `master` | `origin/master` | `9bf72f03` | Gameplay / scoring-lock worktree. Uncommitted INT fix, peer snapshot, win-curve knots, audits. |
| `E:\Dev\17-0-telemetry` | `telemetry-picks` | **`origin/master`** (not its own remote branch) | same `9bf72f03` | Telemetry-only dirty tree. Anonymous pick/spin logging, drizzle `0004`. Older peer snapshot. |

Not checked out as a worktree:

- `pro-set-two-rb` at `433270c` — “Replace fullback with two-RB pro set”. Historical. Pro-set is already in `master` at `9bf72f03`, plus uncommitted lock work on top.

Do not mix the two dirty trees. Do not copy `peer-baselines.json` either direction.

### Uncommitted changes — `E:\Dev\17-0` (`master`)

Nothing staged.

**Modified / added source (scoring lock + UI copy):**

| File | Status | Role |
|---|---|---|
| `src/data/sources/nflverse/regularSeasonProduction.ts` | A (new) | REG-only weekly aggregation; `"0"` INT stays 0; blank stays NULL; POST ignored. |
| `src/data/sources/nflverse/import.ts` | M | Threads `interceptions` through pending seasons and insert. |
| `src/data/sources/nflverse/config.ts` | M | Manifest note: player_stats weeks are REG only. |
| `src/lib/scoring/config.ts` | M | Strike 3-year peers; RB elite rushing floor; switch threshold 0.5; frozen `upperLadder` 15-2=85 / 16-1=89 / 17-0=90.75. |
| `src/lib/scoring/playerSeasonScore.ts` | M | Applies RB elite rushing floor after composite percentile. |
| `src/lib/scoring/peerBaselines.ts` | M | `peerComparisonSeasons()` — only 1982/1987 expand. |
| `src/lib/scoring/selectScoringSeason.ts` | M | Optional `switchThreshold`; production default 0.50. |
| `src/lib/scoring/winProjection.ts` | M | Piecewise upper ladder through those knots. |
| `src/lib/scoring/generated/peer-baselines.json` | M | Regenerated 2026-09-03T02:34:26.373Z; 39,795 seasons; **1,229** buckets. |
| `data/manifests/historical-stats.json` | M | `downloadedAt` → 2026-09-03T02:33:46.074Z. |
| `src/components/game/ResultsView.tsx` | M | “Projected Record” → “Expected Record”; “17–0 Chance” → “Perfect Season Chance”. |
| `tests/resultsUi.test.tsx` | M | Matches that copy. |
| `tests/scoringCalibration.test.ts` | M | Switch-threshold hysteresis fixture. |
| `tests/scoringFbSlot.test.ts` | M | Expectation updates after lock. |
| `tests/scoringTopEnd.test.ts` | M | Top-end expectations after INT/floor/curve. |

**Untracked production/tests:** `tests/nflverseRegularSeasonProduction.test.ts`, `tests/scoringStrikeAndRushFloor.test.ts`, `public/sounds/bad-luck-fail.mp3`, `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`.

**Untracked `tmp-*` harnesses and JSON:** do not commit unless asked. They are the lock/skip audit corpus (variance, ceiling stage 1, skip-aware ceiling, killed human-strategy smoke, INT/legend/RB calibration dumps).

### Uncommitted changes — `E:\Dev\17-0-telemetry` (`telemetry-picks`)

Nothing staged. Telemetry schema/API/tests only. Does **not** contain the INT/lock scoring source changes except an **older** modified `peer-baselines.json` (`generatedAt` 2026-09-02T21:10:08.321Z, **1,203** buckets) and timestamp drift on `historical-stats.json`.

Notable paths: `src/db/schema/telemetry.ts`, `drizzle/0004_telemetry.sql`, `src/lib/telemetry/`, `src/lib/scoring/evaluateSpinOffers.ts`, hooks on spin/skip/pick/score routes, telemetry tests.

### Last 20 commits (`master` / `origin/master`)

```
9bf72f0 2026-08-30 Add 17-0 celebration and rebalance audio volume
433270c 2026-08-30 Replace fullback with two-RB pro set
a64f062 2026-08-30 Polish mobile gameplay and responsive layouts
a8b685c 2026-08-30 Update app icons to new gold football emblem
3b6c816 2026-08-30 Redeploy after Vercel Git reconnect
589781c 2026-08-30 Trigger Vercel production deployment
602659a 2026-08-30 Add favicon, app icons, and PWA install support
a153cab 2026-08-29 Optimize production scoring performance
d922338 2026-08-28 Fix Vercel Linux npm install compatibility
af76924 2026-08-26 Phase 7D: finalize game presentation and results polish
76589f6 2026-08-26 Phase 7C: tighten results layout and polish game UI
311d00f 2026-08-26 Phase 7B: repair historical data and refine game balance
35c4ad6 2026-08-26 Phase 7A: polish football UI and candidate cards
d15db5c 2026-08-25 Phase 6C: refine candidate ordering and audio mix
47f3ef6 2026-08-25 Phase 6B: convert game to 17-game season
a0f5f7b 2026-08-25 Phase 6A: polish spin and results audio animations
c482b37 2026-08-25 Fix PGlite test isolation and local database stability.
aab6d08 2026-08-25 Phase 5D: build projected record and results experience
cd8b149 2026-08-25 Phase 5C: make 16-0 achievable at the extreme scoring tail
7d197fd 2026-08-22 Phase 5B: calibrate player reliability and win projections
```

`origin/main` is a single extra commit, `c92a769` “Add files via upload”, not an ancestor of this list.

### Directory structure (two levels, product-relevant)

```
E:\Dev\17-0
  AGENTS.md, CLAUDE.md, HANDOFF.md, README.md, PROJECT-AUDIT.md
  package.json, package-lock.json, tsconfig.json, next.config.ts
  drizzle.config.ts, eslint.config.mjs, vitest.config.ts, .env.example
  assets/brand/          gold football emblem source
  data/manifests/        nflverse + historical-stats download records
  data/overrides/        manual position overrides
  data/reports/          gitignored coverage dumps (empty in this listing)
  data/reviews/          FB override / coverage review notes
  docs/plans/            pro-set migration plan (stale vs code)
  drizzle/               SQL migrations 0000–0003 + meta snapshots
  public/icons/          PWA icons
  public/sounds/         spin / reveal / draft / results / jackpot SFX
  public/sw.js           service worker
  scripts/               generate-app-icons.mts
  src/app/               Next.js App Router (pages + /api/game)
  src/components/        game UI, PWA register
  src/data/              import pipeline, cards, audits, CLI
  src/db/                Drizzle schema, client, PGlite, seed
  src/lib/               football, game engine, scoring, results, audio
  src/server/            repository adapters, HTTP helpers
  tests/                 Vitest engine + UI + PGlite suites
  .data/pglite/          durable local Postgres-in-WASM (gitignored)
  .cache/                nflverse + historical CSV downloads (gitignored)
  .next/                 last local Next build (gitignored)
```

Untracked `tmp-*.ts` / `tmp-*.json` sit at the repo root. `node_modules/` is present.

### Language, framework, versions, package manager

| Piece | Version / note |
|---|---|
| Language | TypeScript (`typescript` ^6.0.3), `strict` + `noUncheckedIndexedAccess` |
| App | Next.js ^16.3.2 App Router, React ^19.2.8 |
| Package manager | **npm** (`package-lock.json`). No pnpm/yarn lockfile. |
| Package name | `seventeen-and-oh` 0.1.0, `"private": true`, `"type": "module"` |
| ORM | drizzle-orm ^0.45.2, drizzle-kit ^0.31.10 |
| Postgres client | `postgres` ^3.4.9 |
| Local DB | `@electric-sql/pglite` ^0.5.6 |
| Validation | zod ^4.4.3 |
| Tests | vitest ^4.1.11, Testing Library, jsdom |
| Lint | eslint ^9.39.5 + eslint-config-next ^16.3.2 |
| Node | README says Node 20+. No `engines` field in `package.json`. |

`next.config.ts` is empty (`{}`). No Turbopack/webpack overrides in this tree.

---

## 2. Deployment

### Vercel config in the repo

There is **no** `vercel.json`, **no** `.vercel/` directory, **no** GitHub Actions, **no** Vercel project JSON. Framework detection would be default Next.js: `npm run build` → `next build`, `npm start` → `next start`.

Commits on `master` show Git-based Vercel use: “Fix Vercel Linux npm install compatibility”, “Trigger Vercel production deployment”, “Redeploy after Vercel Git reconnect”. `writePeerBaselineSnapshot.ts` comments that `/score` on Vercel must use the committed peer snapshot, not a database scan.

Which Git branch Vercel actually deploys **cannot be determined from this repo**. GitHub’s default branch (`origin/HEAD`) is `main`. The working product is `master`. Those SHAs are different histories.

### Production status (paused vs live)

**Not determinable** from config or docs. README does not say the app is paused. No status file. This audit did not call Vercel.

### Environment variables referenced by code (names only)

**Runtime / CLI (this worktree):**

| Name | Where / purpose |
|---|---|
| `DATABASE_URL` | Postgres/Supabase URI. Required in `NODE_ENV=production`. Optional locally — unset → `.data/pglite`. |
| `NODE_ENV` | Production refuses PGlite fallback. |
| `ALLOW_DESTRUCTIVE_DATA_IMPORT` | Must be `1` to run `data:import` / `data:refresh` against Postgres. |
| `IMPORT_CUTOFF_SEASON` | nflverse download/import cutoff (default 2025). |
| `HISTORICAL_START_SEASON` | Historical CSV window start (default 1970). |
| `HISTORICAL_END_SEASON` | Historical CSV window end (default 1998). |
| `HISTORICAL_FORCE` | `1` to re-download historical CSVs. |
| `VITEST` | Test process flag; blocks durable PGlite; disables peer-cache in ranking. |

**Harness-only (untracked `tmp-*.ts`, not production):** `AUDIT_GAMES`, `AUDIT_SEED_OFFSET`, `AUDIT_SPINS`, `AUDIT_OUT`, `RATINGS_OUT`, `SKIP_SPINS`, `SWEEP_GAMES`, `FINAL_GAMES`, `TUNING_GAMES`, `TUNING_SEED`, `FINAL_SEED`, `TAIL_EXTRA`, `TAIL_SEED`.

`.env.example` documents `DATABASE_URL` and `ALLOW_DESTRUCTIVE_DATA_IMPORT` only. `.env` / `.env.local` are gitignored and were not read.

Vercel-injected names (`VERCEL`, `VERCEL_ENV`, and similar) are not referenced in application source.

### Does production run code matching any local branch?

| Candidate | Match? |
|---|---|
| Local **uncommitted** `master` worktree (INT lock, 90.75 ladder, Results copy) | **No.** None of that is committed. |
| Local **committed** `master` / `origin/master` `9bf72f03` | **Only if** Vercel’s production branch is `master`. That commit still has the old win-curve `tailExtension` (17-0 near rating **92.25**), no REG-only INT aggregator, Results copy “Projected Record”, and the older peer snapshot that was in git at that SHA. |
| Local `telemetry-picks` dirty tree | **No.** Uncommitted, and not a remote branch. |
| GitHub default `main` `c92a769` | **Unknown contents** beyond “Add files via upload”. It is not the 17-0 product history. If Vercel still follows GitHub default `main`, production is **not** the game in this worktree. |

Honest summary: production cannot be the locked scoring model. At best it is `9bf72f03`. At worst it is the disjoint `main` upload.

---

## 3. Database

### Supabase connection

There is no Supabase client SDK. The app talks Postgres through `postgres` + Drizzle.

- URI comes from `DATABASE_URL` (`.env.local` / host env).
- `.env.example` says: Supabase → Project Settings → Database → Connection string → URI.
- `drizzle.config.ts` uses that URL for `drizzle-kit`.
- `src/db/client.ts`: if `DATABASE_URL` is set → Postgres; if unset and not production → PGlite; production without URL throws.

No code in this worktree applies migrations to a remote. `npm run db:migrate` would, if `DATABASE_URL` pointed at Supabase. HANDOFF forbids that unless explicitly asked.

### Full schema (this worktree; telemetry tables are only in the other tree)

**Enums**

| Enum | Values |
|---|---|
| `normalized_position` | `QB`, `RB`, `FB`, `WR`, `TE` |
| `lineup_slot` | `QB`, `RB1`, `RB2`, `WR1`, `WR2`, `TE` (after 0003; 0000 had `RB`/`FB`) |
| `game_status` | `ACTIVE`, `COMPLETE` |
| `game_mode` | `CLASSIC`, `IQ` |

**Tables**

| Table | Columns (type) | Relationships |
|---|---|---|
| `eras` | `id` serial PK; `label` text unique; `start_year` int; `end_year` int | Referenced by cards, picks, sessions’ current era |
| `franchises` | `id` serial PK; `slug` text unique; `canonical_name` text; `canonical_abbreviation` text; timestamps | Identity of a club across relocations |
| `franchise_seasons` | `id` serial PK; `franchise_id` FK cascade; `season` int; `display_name` text; `abbreviation` text; `active` bool | Unique (franchise, season) |
| `players` | `id` serial PK; `first_name`, `last_name`, `display_name` text; `gsis_id`, `pfr_id`, `external_id` text nullable unique on gsis/pfr; timestamps | Internal id is identity |
| `player_seasons` | `id` serial PK; `player_id` FK cascade; `franchise_id` FK cascade; `season` int; `raw_position` text; `primary_normalized_position` enum; `games`, `games_started` int null; passing/rushing/receiving ints **all nullable** including `interceptions`, `rushing_attempts`; `roster_status` text (0001); `source` text; timestamps | Unique (player, franchise, season). NULL ≠ 0. |
| `player_season_positions` | `id` serial PK; `player_season_id` FK cascade; `position` enum; `is_manual_override` bool; `notes` text | Unique (season, position) |
| `player_team_era_cards` | `id` serial PK; `player_id`, `franchise_id`, `era_id` FKs cascade; `first_season`, `last_season` int; `representative_season` int null; `draftable` bool; timestamps | Unique (player, franchise, era). **This is the draftable unit.** |
| `player_team_era_positions` | `player_team_era_card_id` FK cascade; `position` enum | Composite PK |
| `game_sessions` | `id` uuid PK default random; `status`; `mode` default CLASSIC; `team_skip_remaining` int default 1; `era_skip_remaining` int default 1; `current_franchise_id` FK set null; `current_era_id` FK set null; `created_at`; `completed_at` | Current spin stored here |
| `game_picks` | `id` serial PK; `game_session_id` FK cascade; `round_number` int; `lineup_slot` enum; `player_id` FK restrict; `player_team_era_card_id` FK restrict; `franchise_id` FK restrict; `era_id` FK restrict; `created_at` | Unique per session on slot, player, and round |

PGlite also has `__local_migrations` (id, applied_at) — not a product table.

**Telemetry worktree only (not in this schema):** `telemetry_completion_state` enum; `telemetry_games`, `telemetry_spins`, `telemetry_spin_candidates`, `telemetry_picks`. No FKs onto gameplay tables. `game_session_id` is stored as uuid without a foreign key.

### Migrations (`drizzle/`), in order

| File | What it does | Applied? |
|---|---|---|
| `0000_swift_quasimodo.sql` | Creates enums (original `lineup_slot` included `RB`/`FB`) and all core tables, FKs, indexes. | Journaled. Local PGlite bootstraps it if `eras` already exists. |
| `0001_roster_status.sql` | `ALTER TABLE player_seasons ADD COLUMN roster_status text`. | Journaled. Local bootstrap if column exists. |
| `0002_game_mode_and_skips.sql` | `game_mode` enum; `game_sessions.mode`, `team_skip_remaining`, `era_skip_remaining`. | Journaled. Local bootstrap if `mode` column exists. |
| `0003_pro_set_lineup_slots.sql` | Rebuilds `lineup_slot` to `QB/RB1/RB2/WR1/WR2/TE`. Maps old `RB`→`RB1`, `FB`→`RB2`. | In journal. Local PGlite applies it on open if not recorded. **Supabase: HANDOFF says this session did not apply 0003 remotely. Remote may still be pre-pro-set.** |
| `0004_telemetry.sql` | **Only in `E:\Dev\17-0-telemetry`.** Creates telemetry tables. | Not in this worktree. Not applied to Supabase in the prior session. |

Known applied vs pending:

- **This worktree’s journal** lists 0000–0003. Local PGlite auto-applies missing SQL on open.
- **Production/Supabase** was not inspected. Treat 0003 as **unknown / likely pending** on remote. Do not `drizzle migrate` against production.
- **0004** is pending everywhere that is not the telemetry worktree’s own DB, and must not be applied on remote without 0003 awareness.

### Local PGlite

| Item | Detail |
|---|---|
| Path | `E:\Dev\17-0\.data\pglite` (`LOCAL_PGLITE_DIR`) |
| When used | `DATABASE_URL` unset, `NODE_ENV` not production. Shared by `next dev` and data CLI. |
| How it differs from production | WASM Postgres files on disk; custom `__local_migrations` rather than Drizzle’s `drizzle.__drizzle_migrations`; stale `postmaster.pid` cleaner; tests **must not** open this directory (isolated temp/in-memory instead). |
| How rebuilt | `data:import` / `data:refresh` wipe gameplay + historical tables (allowed automatically on PGlite). `data:build-cards` deletes cards **and all game sessions/picks**, then rewrites cards. Opening the DB applies any new `drizzle/*.sql`. Do not `data:import` while `next dev` holds the live files; harnesses `cp` the directory excluding `postmaster.pid`. |
| Last write seen | Directory mtimes 2026-09-02 ~22:34 local — consistent with the 2026-09-03 02:33Z INT-aware rebuild. A `pglite-corrupt-backup-20260825-*` sibling exists. |

`npm run db:seed` calls `createDatabase()` and **requires** `DATABASE_URL`. It will not seed PGlite. It is a full wipe-and-load of fictional `devData.ts` and is unsafe if `DATABASE_URL` points at shared Postgres.

### Row counts (no live query)

From audit JSON that copied this PGlite after the 2026-09-03 lock rebuild:

| Entity | Count | Source |
|---|---|---|
| Player-seasons in peer index | **39,795** | `peer-baselines.json` + variance/int-lock JSON |
| Peer buckets | **1,229** | lock snapshot |
| Season range in snapshot | 1960–2025 | snapshot meta |
| Draftable cards loaded by harness | **11,750** | `tmp-variance-decomposition-results.json` / int-lock JSON (`listDraftableCards` for all normalized positions, including FB-only cards that cannot fill a slot) |
| Playable eras | 6 (1970s–2020s) | code + snapshot |
| Franchise lineages in source | 32 NFL clubs | `src/data/franchises/lineages.ts` |
| Position overrides | 7 | `data/overrides/position-overrides.json` |

Not available without querying: `players`, `player_seasons` raw row count vs peer join, `franchise_seasons`, `game_sessions`, `game_picks`, `player_season_positions`. Coverage reports under `data/reports/` were not present on disk (gitignored and empty).

---

## 4. Data pipeline

### External sources

| Source | What | Years |
|---|---|---|
| **nflverse** GitHub Releases CSVs | `roster_{season}.csv` (identity, team, position, roster status). `player_stats_{season}.csv` weekly box scores. Public HTTP GET, cached under `.cache/nflverse/`. Never called at spin time. | Rosters **1960–2025** (import start 1960, cutoff 2025). `player_stats` authoritative from **1999**. Working-tree importer keeps **REG weeks only**; POST ignored. |
| **MarcLinder GitHub NFL_Stats** | Season passing/rushing/receiving leaderboard CSVs (NFL.com mirrors). No team column. Cached under `.cache/historical-stats/`. | **1970–1998** only. Never writes 1999+. |
| Manual overrides | `data/overrides/position-overrides.json` | Named seasons; mostly FB eligibility. |

Playable product window is **1970s–2020s**. Pre-1970 roster rows exist for identity continuity and are not playable spins. 2025 roster-only rows without weekly stats are undraftable under current rules.

Manifests: `data/manifests/nflverse.json` (rosters downloaded 2026-08-22), `data/manifests/historical-stats.json` (re-touched 2026-09-03).

### Import chain (order)

Typical full refresh (`npm run data:refresh`):

1. **`data:download`** (`src/data/cli/download.ts`) — HTTP GET nflverse CSVs through cutoff; write `data/manifests/nflverse.json`. Safe to re-run; `--force` re-downloads.
2. **`data:import`** (`src/data/cli/import.ts` → `importNflverseHistoricalData`) — **destructive**. Wipes picks, sessions, cards, seasons, players, franchises, eras. Rebuilds eras, franchise lineages, players from rosters, seasons (1999+ production from REG weeks including INT), cards. Postgres requires `ALLOW_DESTRUCTIVE_DATA_IMPORT=1`.
3. **`data:download-historical`** — GET 1970–1998 CSVs. Safe to re-run.
4. **`data:enrich-historical`** — matches leaderboard rows to existing `player_seasons` by name+season (no team). Updates production fields only; **never creates roster rows**. Then runs coverage audit.
5. **`data:audit`** — writes `data/reports/coverage-audit.*` (gitignored).
6. **`data:build-cards`** — re-applies position overrides, **deletes all cards and all game sessions/picks**, rewrites cards, then **`scoring:build-baselines`**.
7. **`scoring:build-baselines`** — scans all player-seasons, writes `src/lib/scoring/generated/peer-baselines.json` (committed artifact).

Also: `data:sanity` (landmark player checks), `scoring:audit`, `data:cli/integrityAudit.ts`.

`npm run dev` never downloads or imports.

### Historical enrichment vs modern source

| | 1970–1998 | 1999–cutoff |
|---|---|---|
| Roster / identity | nflverse rosters | nflverse rosters |
| Production | MarcLinder season totals patched onto existing season rows. Games/GS often **NULL** (not in those CSVs). | nflverse weekly `player_stats`, aggregated. Working tree: REG only; INT from `interceptions` (passing), `"0"`→0, blank→NULL. |
| Provenance | `nflverse+historical-stats` | `nflverse` |
| Join | Name + season against nflverse rows; ambiguous/unresolved written to reports | GSIS id + team + season |

NULL vs 0 is a first-class rule everywhere.

### Cards

A **card** is one player × one franchise × one era (`player_team_era_cards`). A player who changed teams in a decade gets multiple cards. Positions on the card are the union of normalized season positions. `draftable` is computed by `src/data/draftable.ts`: needs a skill position and participation evidence (games > 0 with role-consistent production, or NULL games with production, plus a narrow FB-with-games exception). Roster status alone is not enough. WR/TE need receiving; gadget rush-only is not a WR/TE card. QB rushing without passing is allowed.

Built only via `derivePlayerTeamEraCards` — never hand-written. `representative_season` is the season with most games in the stint; it is **not** the scoring season.

How many: harness loaded **11,750** draftable cards from local PGlite (includes FB-only draftable rows that cannot occupy a pro-set slot). Total non-draftable cards were not counted.

### Peer baselines

Same-season (except strike years) distributions of each metric, keyed `season:position:metric`, used for percentile rank.

- Built from every `player_seasons` row that has positions, via `PeerBaselineIndex`.
- Production `/score` loads the **committed JSON snapshot** (`loadRuntimePeerBaselines`). No runtime fallback to a full DB scan. Missing/invalid snapshot fails scoring.
- Regenerated with `scoring:build-baselines` / end of `data:build-cards` after import or rule changes.
- Lock snapshot: `generatedAt` 2026-09-03T02:34:26.373Z, 39,795 seasons, 1,229 buckets, eras 1970s–2020s listed even though buckets start 1960/1970.
- CLASSIC candidate **ranking** in this worktree still calls `loadAllSeasonStatsForPeers()` and builds an in-process index (cached per Node process). That path is unused by the IQ-only UI but is a second, DB-heavy copy of the same math.

### Destructive vs safe to re-run

| Step | Destructive? |
|---|---|
| `data:download`, `data:download-historical` | No (cache fill). |
| `data:import`, `data:refresh` | **Yes** — wipes games + historical tables. Guarded on Postgres. |
| `data:enrich-historical` | Updates season production in place. Not a full wipe; can change scores. |
| `data:build-cards` | **Yes for games** — deletes sessions/picks and all cards, then rewrites cards. Also regenerates peer JSON. |
| `scoring:build-baselines` | Overwrites committed `peer-baselines.json`. Changes `/score` for everyone who deploys that file. |
| `data:audit`, `data:sanity` | Read + report files. |
| `db:seed` | **Yes** on whatever `DATABASE_URL` is. Fictional data. |
| `db:migrate` / `db:push` | Schema change on the connected database. Unsafe on production. |

HANDOFF: do not rebuild nflverse / peers / cards unless asked.

---

## 5. Scoring model

Player evaluation is **LOCKED** on this worktree (Option A) unless the user reopens it. Below is the working-tree model, which is **not** what `9bf72f03` production would run.

### Path from raw stats to a card’s number

1. Load every `player_seasons` row for that card’s player+franchise whose `season` is inside `firstSeason`–`lastSeason`.
2. Drop seasons that are not “legitimate”: keep if `games >= 4` **or** any production field is non-null (`isLegitimateScoringSeason`).
3. For each remaining season, score at the **slot’s position** (`positionForSlot`: RB1/RB2 → RB, WR1/WR2 → WR):
   - For each weighted metric, skip NULL raw values (missing ≠ 0).
   - Percentile vs that season’s peer bucket (strike years merge adjacent seasons).
   - Interceptions invert (lower is better).
   - Composite = weighted average of available percentiles, then **RB elite rushing floor** if applicable.
   - Map composite percentile through `calibratePercentileToScore` → `rawProductionScore` on ~22–94.
   - Compute **reliability** from games + cohort volume; shrink toward 50 → `adjustedProductionScore`.
4. **Season selection:** walk eligible seasons in repository order. Replace the current best only if the new adjusted score beats it by **more than 0.5**. Inside the band, prefer higher reliability (+0.05), then more games. That selected adjusted score is the card’s **overall**.
5. If no metric had a value, **neutral fallback**: raw 50, reliability 0.15, adjusted near 50, LOW confidence.

Six of those overalls become the lineup; see §6.

`/score` uses the snapshot index. It does not rescan the corpus.

### Exact metric weights

| Position | Metrics |
|---|---|
| **QB** | pass yds 0.35, pass TD 0.30, INT 0.15, rush yds 0.10, rush TD 0.10 |
| **RB** | rush yds 0.40, rush TD 0.25, receptions 0.10, rec yds 0.15, rec TD 0.10 (**65% rush / 35% receive**) |
| **FB** (historical profile only; not a slot) | rush yds 0.30, rush TD 0.20, rec 0.15, rec yds 0.20, rec TD 0.15 |
| **WR** | rec yds 0.40, rec TD 0.30, receptions 0.20, rush yds 0.05, rush TD 0.05 |
| **TE** | rec yds 0.40, rec TD 0.30, receptions 0.30 |

Available weights are renormalized when some metrics are NULL.

Leftover **FB-slot** constants still exist (`FB_SLOT_METRIC_WEIGHTS`, feature-back blend 0.6, 400 rush yards / 100 attempts). `scorePlayerSeason` ignores slot options (`_options`). `evaluateLineupPick` never calls `fbSlot.ts`. RB1 and RB2 both use RB weights. Dead path, still tested.

### Percentiles and peer group

- Rank = (peers strictly below + 0.5×ties) / n × 100. Empty pool → 50. One peer: 50/75/25.
- Default peer group: **same NFL season + same normalized position**.
- **1982** compares to 1981–83; **1987** to 1986–88. Other years, including early 1970s, stay single-season.
- FB metric buckets may fall back to RB if FB sample < 5 (`MIN_PEER_SAMPLE`). RB never uses that fallback.
- Snapshot includes pre-1970 seasons for peers even though those years are not playable cards.

### Reliability

Not a talent penalty for “old era small volume.” It is cohort-relative shrinkage toward 50.

- Games factor: 14+ games → 1.0; steps down to ~0.05 at 0; NULL games infers from volume percentile or 0.35.
- Volume metrics by position (QB pass yds/TD; RB rush + rec; etc.). RBs/FBs also proxy attempts×4 as rush yards.
- `reliability = clamp(gamesFactor × (0.18 + 0.82×volumeNorm^0.72), 0.12, 1)` with a full-season floor (~0.92+) when gamesFactor ≥ 0.88 and volume percentile ≥ 45.
- Shrinkage: `50 + weight×(raw−50)`, clamped 22–94. If known games < 6, `weight = reliability^1.45`. Neutral fallback stays near 50.

### Season selection and switch threshold

`SCORING_SEASON_SWITCH_THRESHOLD = 0.5`. Later/other seasons must beat the current best by **more than 0.5 adjusted points**. Inside the band: reliability then games. 0.25 and 0.00 were audited and rejected (HANDOFF). Tests may pass an override; production does not.

The selected year is hidden at IQ pick time. Results may show `Season {year}`.

### Special-case rules currently in the model

- REG-only nflverse weeks; POST excluded (working tree).
- Passing INT field; true zero vs NULL.
- Strike-year peer windows 1982 / 1987 only.
- Early-1970s **not** 3-year smoothed.
- RB 65/35 weights (locked).
- RB elite rushing floor: if rushing-only percentile ≥ **98.5**, composite cannot fall more than **2** points.
- FB participation exception for draftability (games > 0, no box-score production).
- FB-only cards are not playable; dual RB/FB cards play as RB.
- Unified P90-excess tail: **rejected**, not in `src/lib/scoring/`.
- Lineup **balance** adjustment after slot weights (weak min < 42 penalty, strong min ≥ 68 bonus), then × `BALANCE_WEIGHT` 0.08.
- Data confidence HIGH/MEDIUM/LOW from metric coverage ratio (0.7 / 0.4).
- Known locked quirks: Peyton 2013 ranks poorly on rush/INT shape; 2025 roster-only rows undraftable.

### The 22–94 scale

`SCORE_CALIBRATION.minScore = 22`, `maxScore = 94`, midpoint 50 at the 50th percentile.

`calibratePercentileToScore`: below P50 uses exponent 1.15 (compresses the floor toward 22); above P50 uses 0.78 (stretches elites toward 94 without reaching 100). Comment in code: keep elite seasons below 100 so separation remains visible. Reliability clamp uses the same 22–94 bounds. Overall offense rating is then clamped 0–100 after balance, so a lineup can sit slightly outside a single player’s 22–94 box via weighting/balance, but players themselves cannot.

Committed HEAD still uses this 22–94 player scale. The **win-curve mapping of rating → record** is what changed in the lock (see §6).

---

## 6. Game mechanics

### Flow of one game

1. Home (`/`) shows `ModeSelector`. The only start button calls `beginFreshGame("IQ")`. There is **no CLASSIC chooser** in the UI.
2. `POST /api/game/start` `{ mode }` creates a session: 6 empty slots, 1 team skip, 1 era skip, no current spin.
3. Player hits Spin. UI plays a franchise/era reveal against a visual pool. Server `POST /api/game/spin` rolls a legal franchise+era, stores it on the session, returns candidates.
4. Player may Team Skip (keep era, new franchise) or Era Skip (keep franchise, new era), each once per game, only with an active spin.
5. Player selects a candidate, then an eligible empty slot on the formation. `POST /api/game/pick` validates against the stored spin and writes the pick. Same player cannot be drafted twice. Spin clears.
6. Repeat until six picks. Session → `COMPLETE`. UI shows completed lineup, then `View Results` → `/game/{id}/results`.
7. Results client `GET /api/game/{id}/score`, which runs `evaluateCompletedGame` → `evaluateLineup` → win projection. Record counts up; 17–0 plays jackpot/confetti. Play Again returns to the start screen.

Engine is the authority (`src/lib/game`). UI may hide illegal options but never decides them. Repository port keeps SQL out of the engine.

### What a spin does; candidate pool

- Load draftable cards whose positions can still fill **open** slots, excluding already-drafted player ids. **No pool size cap.**
- Bucket by franchise+era. Drop buckets with zero legal cards for current open slots (no dead-end spins).
- Uniform random among remaining combinations (`Math.random` in production; harnesses inject mulberry32).
- Store `current_franchise_id` / `current_era_id` on the session.
- Return those cards with eligible slots. CLASSIC also attaches **summed** window production (not the scoring season). IQ still loads that payload but the UI does not show stats.
- Reload uses `loadCurrentSpin` so refresh does not re-roll.
- Order: IQ alphabetical (first, last, card id). CLASSIC by engine overall descending (then name, card id).

HANDOFF prior audit: early-game median pool ~63, max 106; position filter medians ~9/20/21/11. Pool size ~uncorrelated with BEST rating.

### Lineup slots

Pro-set: `QB`, `RB1`, `RB2`, `WR1`, `WR2`, `TE`. WR1/WR2 both accept `WR`. RB1/RB2 both accept `RB`. `FB` is a historical normalized position, not a slot. Player assigns the card to one highlighted empty slot. WR labels collapse to “WR” in some chrome; RB1/RB2 stay distinct.

### Six scores → team offense rating

`LINEUP_SLOT_WEIGHTS`:

| Slot | Weight |
|---|---|
| QB | 0.30 |
| RB1 | 0.115 |
| RB2 | 0.115 |
| WR1 | 0.16 |
| WR2 | 0.14 |
| TE | 0.12 |

Raw sum **0.95**. `evaluateOffense` divides by that sum, so effective weights renormalize to 1.0.

`weightedTalentRating = Σ (slotWeight × player.overall) / 0.95`

Balance: if the weakest overall < 42, penalty up to 7; if weakest ≥ 68, bonus up to 4.

`overallRating = clamp(weightedTalent + balanceAdjustment × 0.08, 0, 100)`

Copy assumption (not simulated): league-average OL, defense, ST, coaching, schedule. You draft the skill core only.

### Offense rating → win probability

Working-tree `perGameWinProbabilityFromRating`:

- Rating ≤ 80: logistic, midpoint 62, steepness 0.081, clamped to [0.05, 0.99].
- Above 80: piecewise-linear in probability space through knots: 15-2 at **85**, 16-1 at **89**, 17-0 at **90.75**, then 0.99 at rating 95.

Committed HEAD instead uses `tailExtension` from 90.5 toward a 17-0 near **92.25**. That is what a `master` deploy would still run.

### Win probability → displayed record

`expectedWins = 17 × p`. `projectedWins = round(expectedWins)` clamped 0–17. Losses = 17 − wins. UI label in the lock tree: **Expected Record**. Animation counts to that rounded pair. Tiers are presentation-only (ROUGH … 17-0).

Approximate locked knots: 13-4 ≈ 74.62, 14-3 ≈ 78.67, 15-2 = 85, 16-1 = 89, 17-0 = 90.75. Binary search `ratingThresholdForProjectedWins(17)` ≈ **90.753**.

### Perfect season chance

`perfectSeasonProbability = p^17` using the **engine** `p`, never a display-rounded percentage. That bug (0.966^17 vs 0.96605^17) is explicitly guarded in `winProjection.ts` and format comments.

### IQ vs CLASSIC

| | IQ | CLASSIC |
|---|---|---|
| UI start | **Only mode the start screen launches** | Engine/API still accept it; no start-screen button |
| Candidate order | Alphabetical | Engine overall, best first |
| Pick-time stats | Hidden | Summed franchise/era-window production (Pass/Rush/Rec rows by role) |
| Pick-time engine score / rank / scoring season | Hidden (product rule) | Not shown as numbers, but **order is the ranking** |
| Scoring | Same `evaluateLineup`. Mode does not change math. | Same |
| Results | Player overall + selected season + confidence. Metric details **hidden**. | Same plus expandable “Season production” percentiles |

DB default for `game_sessions.mode` is still `CLASSIC`. The UI never sends that.

### What the player sees at pick time

**Both modes:** franchise name/abbreviation, era label, candidate name, playable positions (FB stripped from badge), years with that franchise, “Can Fill: …” slots, search + position chips, skip buttons with remaining counts, formation with empty/filled slots.

**IQ only:** no stat line, no rating, list A–Z.

**CLASSIC only:** three/four box-score stats from the **window sum**, dashes for missing. Best engine card is first in the list.

Neither mode shows the engine scoring season at pick time.

---

## 7. Simulation harness

Not part of `package.json`. Untracked root scripts. They copy `.data/pglite` (drop `postmaster.pid`), open a throwaway PGlite, load all draftable cards + peer seasons, pre-score every card×slot, then play games against `startGame` / `spinGame` / `draftPlayer` with injected RNGs. They do **not** change scoring. HANDOFF: do not restart the killed human-strategy run unless asked.

### Where / how

| Script | Role |
|---|---|
| `tmp-game-balance-audit.ts` | Unpaired 10k/strategy. `SKIP_SPINS=1` omits extra **presentation** spins, **not** Team/Era Skip. `skipUsed` hardcoded 0. |
| `tmp-variance-decomposition.ts` | Paired seeds 1–10000, five strategies, **no user skips**. Split RNGs: `mulberry32(seed)` spins, `mulberry32(seed ^ 0x9e3779b9)` picks. |
| `tmp-ceiling-stage1.ts` | GREEDY_POSTHOC slot reassignment on the same six greedy cards. Stages 2–3 never started. |
| `tmp-skip-aware-ceiling.ts` | GREEDY only; skip policy uses hidden combo-best. |
| `tmp-skip-aware-human-strategy.ts` | Policy-conditional skips (TOP_N/RANDOM expected pick). Full eval JSON **never flushed**; disk JSON is n=15 smoke. |

### Strategies

Candidates are ordered as CLASSIC (engine overall). Slot among a chosen card’s eligibles is the highest score, tie-break higher slot weight — except RANDOM, which also randomizes slot.

| Name in harness | Behavior |
|---|---|
| `BEST_AVAILABLE` (GREEDY) | Always take ordered[0], best slot. Consumes no pick RNG. |
| `TOP_3_SELECTION` | Uniform among the top min(3, n) ordered cards. |
| `TOP_5_SELECTION` | Same, n=5. |
| `TOP_7_SELECTION` | Same, n=7. |
| `RANDOM` | Uniform among **all** candidates; random eligible slot. |

### Population

Local historical PGlite: 11,750 draftable cards, 39,795 peer seasons, real spin combinations (1970s–2020s, open-slot legal). Not the fictional `db:seed` set.

### Typical 10k runtime (from prior JSON, not re-run)

| Run | elapsedMs | What |
|---|---|---|
| Variance paired 10k × 5 strategies, no skips | 530,523 (~8.8 min) | ~11 ms/game; one strategy × 10k ≈ **1.8 min** |
| Unpaired int-lock 10k/strategy | 525,522 (~8.8 min) | Similar |
| Skip-aware GREEDY: 2k sweep + 10k final | 775,972 (~12.9 min) | Skip-aware 10k alone on the order of **~10 min** |
| Human-strategy 5 strategies + 40k tail | Killed at ~35 min during GREEDY tail ~18400/40000 | Write happens only at end of `main()` — RAM lost |

Do not treat the n=15 smoke JSON as evaluation.

---

## 8. Testing and CI

- **Framework:** Vitest 4, `tests/**/*.test.ts` and `*.test.tsx`, setup `tests/setup.ts` (jest-dom, stubbed media). Default environment `node`; React tests use Testing Library.
- **Count:** 52 `*.test.*` files (+ 3 helpers + setup). No coverage report checked (not run).
- **Commands:** `npm test` → `vitest run`; `npm run typecheck` → `tsc --noEmit`; `npm run lint` → `eslint .`; `npm run build` → `next build`.
- **CI:** **None.** No `.github/workflows`, no Vercel-ignored test hook in-repo.

**Covered (by suite names and layout):** engine rules (spin, pick, eligibility, lineup, skips, modes), PGlite migrations/isolation/import/rebuild, draftability, historical parse/enrich/sanity, franchise aliases, peer snapshot load, scoring calibration/fairness/top-end/FB leftovers/strike+rush floor (untracked), results formatting/UI copy, start screen, PWA manifest, audio stubs, destructive-import guard, Next DB backend resolution, classic displayed production, pro-set enum migration SQL, candidate order IQ vs CLASSIC.

**Not covered or thin:** skip-aware human ladder (harness only); beam/oracle path search; stochastic seasons (not implemented); telemetry (other worktree); live Supabase; Vercel build; service-worker behavior in browsers; no e2e (Playwright is nested in dependencies but not a project script). CLASSIC is tested as an API mode even though the UI never starts it. FB-slot scoring tests remain after the slot was removed.

Untracked tests (`nflverseRegularSeasonProduction`, `scoringStrikeAndRushFloor`) exist only in this dirty tree.

---

## 9. Documentation on disk

No `.canvas.tsx` files.

| Path | One line |
|---|---|
| `README.md` | Product intro + setup; still labeled “Phase 1 scope”; API table missing skips and `/score`; scoring snapshot notes are current. |
| `HANDOFF.md` | 2026-09-03 agent handoff: two worktrees, lock table, open questions, killed harness. |
| `AGENTS.md` | Next.js `generate-agent-files` stub (“this is not the Next.js you know”). Reappears if deleted. |
| `CLAUDE.md` | `@AGENTS.md` only. |
| `docs/plans/pro-set-two-rb-migration.md` | Pro-set plan marked “do not implement until approved” — **already shipped** on `master` `433270c`. |
| `data/reviews/fb-zero-before.txt` | Pre-override FB-zero coverage notes. |
| `data/reviews/fb-zero-before.json` | Machine-readable companion. |
| `data/reviews/fb-zero-after.txt` | Post-override FB notes. |
| `data/reviews/fb-override-candidates.json` | Candidate list for FB overrides. |
| `data/manifests/nflverse.json` | Download provenance for nflverse CSVs. |
| `data/manifests/historical-stats.json` | Download provenance for 1970–1998 CSVs. |
| `data/overrides/position-overrides.json` | Seven manual position overlays. |
| `.env.example` | `DATABASE_URL` + destructive-import flag. |
| `PROJECT-AUDIT.md` | This file. |

---

## 10. Honest assessment

### What is solid

The draft engine is small, port-based, and actually enforced on the server: spins cannot dead-end, picks bind to the stored franchise/era, eligibility lives in one module, NULL vs 0 is consistent. Pro-set slots, IQ-as-the-shipped-mode, skips, PWA chrome, and results presentation are a coherent product. Historical import is reproducible (pinned URLs, manifests, no scrape at spin time). Scoring is explicit, test-backed, and after the lock, internally consistent: REG INT restore, strike windows, RB floor, 0.5 hysteresis, frozen win knots. The peer snapshot lets `/score` run on Vercel without dragging 40k seasons across the wire. PGlite + migration journal makes local history work without Docker. The audit harnesses (paired RNGs, skip definitions, stage-1 ceiling) are unusually careful for game-balance work.

### What is fragile or half-finished

Two dirty worktrees and two peer snapshots. Scoring lock is uncommitted; production cannot see it. GitHub default `main` is a disjoint upload. README and the pro-set plan are stale. FB-slot scoring code is dead but still exported. CLASSIC ranking still full-scans seasons despite the snapshot. `data:build-cards` silently kills all games. `db:seed` requires Postgres and will smash whatever `DATABASE_URL` is. Coverage reports are gitignored and absent. Telemetry 0004 is a second schema sitting on a possible missing 0003. The skip-aware human ladder — the thing the record knots are waiting on — has **no** eval JSON, only a killed process and an n=15 smoke file. Stochastic seasons are not started. IQ results still print engine overalls after the fact, which is fine, but CLASSIC would leak rank via sort order if anyone launched it.

### Biggest technical risk

**Shipping or migrating the wrong database/branch.** Remote Postgres may still have pre-pro-set `lineup_slot` (`RB`/`FB`). A `db:migrate` / `data:import` / `db:seed` against `DATABASE_URL` is irreversible for games and possibly for schema. Independently, if Vercel follows GitHub `main`, users are not on `9bf72f03` at all. If it follows `master`, they are on a scoring model the last two sessions already rejected (INT hole, 92.25 17-0 tail). Mixing telemetry’s 1,203-bucket snapshot with the lock’s 1,229 silently rescoring is the same class of footgun.

### Biggest gap between documentation and behavior

README still says “Phase 1 scope: … No historical import, no scoring, no final UI” and lists an incomplete API, while the app is a finished six-pick 17-game IQ product with scoring, skips, PWA, and results. The start screen copy is “TEST YOUR FOOTBALL IQ” / “PROVE IT” with no mode picker, while schema, API, and README still present CLASSIC as a first-class mode (and the session column defaults to CLASSIC). `docs/plans/pro-set-two-rb-migration.md` says do not implement; `master` already did. Committed HEAD comments still describe 17-0 near rating 92.25; the lock on disk uses 90.75 and the UI says “Expected Record” / “Perfect Season Chance”. None of that lock is what production runs today.

---

*End of inspection. No other files were modified.*
