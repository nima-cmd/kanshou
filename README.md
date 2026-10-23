# Kanshou 鑑賞

Our household anime diary: today's slate, episode progress, and (soon) the log.
See [CLAUDE.md](CLAUDE.md) for the vision and [docs/ROADMAP.md](docs/ROADMAP.md) for progress.

Runs on Cloudflare's free plan: a Worker (Next.js via OpenNext) plus a D1 database.

## Local development

```bash
pnpm install
cp .dev.vars.example .dev.vars     # then fill in both values (see the file)
pnpm db:migrate:local              # creates the local D1 database under .wrangler/
pnpm dev                           # http://localhost:3000
pnpm dev:lan                       # same, reachable from the iPad at http://<computer>.local:3000
pnpm ipad                          # the real Worker build, served on Wi-Fi at port 3000
```

Sign in with the `HOUSEHOLD_PASSPHRASE` from `.dev.vars`. The first sign-in asks for a profile name.

**Live at https://kanshou.anime-tracker.workers.dev** (first deployed 2026-10-22). Later deploys are just `pnpm run deploy`.

## First deploy to Cloudflare

Already done for this project — kept here for reference, or for setting it up somewhere new.
Note `pnpm` itself comes from corepack on this machine: if `pnpm` is not found, run
`corepack enable --install-directory ~/.local/bin` once rather than installing it globally,
so `package.json`'s pinned version keeps winning.

Run these once, in order, from the project folder:

```bash
pnpm wrangler login                # opens the browser; sign in to Cloudflare (free account)
pnpm wrangler d1 create kanshou    # prints a database_id
```

When `d1 create` offers to add the binding to the config for you, **say no.** It would append a
second entry bound to `kanshou`, but the code reads `env.DB`, and its snippet drops
`migrations_dir`. Keep the block already in `wrangler.jsonc` and change only the id.

Paste that `database_id` into `wrangler.jsonc` (replacing the zeros), then:

```bash
pnpm db:migrate:remote             # creates the tables in the real database
pnpm run deploy                    # builds and uploads; prints https://kanshou.<you>.workers.dev
pnpm wrangler secret put HOUSEHOLD_PASSPHRASE    # type the passphrase you'll both use
openssl rand -base64 32 | pnpm wrangler secret put SESSION_SECRET
```

Later deploys are just `pnpm run deploy`. Schema changes: add a file to `migrations/` and run `pnpm db:migrate:remote`.

### Moving the iPad over from Phase 1
The Phase 1 app kept its data in the iPad's browser, tied to its old address, so the data doesn't follow automatically:
1. In the **old** Kanshou on the iPad: Settings → **Save backup** (saves a .json file to Files).
2. Open the new `https://kanshou.<you>.workers.dev` in Safari, sign in, then Settings → **Restore…** and pick that file. It uploads to the household.
3. Share → **Add to Home Screen** for the new address, and delete the old icon.

Offline caching turns on automatically now, since the deployed site is HTTPS.

## How sync works
- Every tap saves locally first (instant, works offline), then syncs about a second later.
- The app also syncs when it comes back on screen, when the connection returns, and every 30 s while open. An idle check reads one database row.
- Conflicts: the newest change wins, per show for progress and as a whole for the rotation.

## Free-plan headroom
Workers Free gives 100k requests/day. D1 Free gives 5M rows read and 100k rows written per day, and 500 MB per database. Since Sept 2026, D1 queries fail for the rest of the UTC day once a limit is hit. Two people use a tiny fraction of that. Images come straight from AniList's CDN and never touch our quotas.

## Data sources
Anime data and images from [AniList](https://anilist.co).
