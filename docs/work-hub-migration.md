# Kanshou → Work-Hub Home: the migration spec

Written 2026-11-24 on the home PC, for whoever builds this — home Claude, work Claude, or Nima.
The counterpart briefing is `HOME-CLAUDE.md` in `nima-cmd/nima-cmd-work`.

Status: **spec only. Nothing has been built.** Kanshou is live and in use at
<https://kanshou.anime-tracker.workers.dev> throughout.

---

## 0. What Home actually is (read this before designing anything)

Nima's framing, 2026-11-24, and it corrects an earlier reading of Home as "a work feature that
shows some personal repos":

> *"this is home hub — we just wanted it living off the server and tools we have for work, and for
> the two to interact. However most of the building will be happening here. We wanted Work-Hub to
> help us with work; Home is designed to help us with home life as well as home projects, which
> are all these repos — those are the work we're trying to manage. We might add other projects.
> We want this to be a guide, to suggest, to help us, encourage us along — to do what Work-Hub
> does for work, for our home life."*

Three consequences that should shape every decision below:

1. **Home is a peer of Work-Hub, not a subsection of it.** It shares the server, the database
   cluster and the auth because that infrastructure already exists and is paid for — not because
   home life is a work concern. Keep the home-side code separable enough that it could be lifted
   out later without unpicking warehouse code.
2. **Its job is to suggest and encourage, not to store.** Work-Hub's value for work is that it
   *tells you what needs attention*. Home's value is the same: what have you neglected, what's
   tonight's plan, what did you finish. Features that don't serve that are decoration.
3. **It must accept new areas without a rewrite.** "We might add other projects" is a
   requirement, not an aside. Anime and games are the first two; treat them as instances of a
   pattern, not as bespoke screens.

**Most building happens on the home PC.** The file boundary from `HOME-CLAUDE.md` is what keeps
that safe — see §7.

---

## 1. The one hard rule: one owner per fact

On 2026-11-24 the home PC and GitHub disagreed about which lesson was active. `SYLLABUS.md` said
T3-02 locally and T3-01 on GitHub, because three months of commits had never been pushed. Home
read GitHub, believed it, and spent weeks suggesting drills that closed in September. Seven repos
turned out to hold unpushed or untracked work; two had never been pushed at all.

**The cause was two stores of one fact with no owner.** Any design that lets both Postgres and a
git repo hold the same truth rebuilds that bug. So:

| Fact | Owner | Home's access |
|---|---|---|
| Episodes watched, ratings, reviews, finish dates, rewatches | **Postgres** | read + **write** |
| Game logs, evening logs, crew points, streaks | **Postgres** | read + **write** |
| Lesson completion, ledger write-ups, source code, artwork, `SYLLABUS.md` | **the repos** | **read only** |

Diary data has no business in git. Work product has no business being authoritative in a web app.
A lesson is finished when the work exists in the repo — not when a button was pressed.

**If repo writes are ever genuinely needed, Home opens a pull request.** It never pushes. A
write-scoped token across every repo is a large blast radius for a convenience feature; a PR keeps
the audit trail and cannot rewrite history.

---

## 2. What moves, and what evaporates

Kanshou's current D1 schema is in `migrations/0001_init.sql` and `0002_changed_at.sql`. Three
tables exist only because Kanshou is a standalone app, and **Work-Hub already solves what they
solve** — it sits behind `SITE_PASSWORD` and already knows who is looking.

| D1 table | Fate in Work-Hub |
|---|---|
| `household` | **drop.** One household is implicit. `rotation_size` becomes a row in Work-Hub's existing settings, `changed_at` is unnecessary (see below). |
| `profile` | **drop**, replaced by Work-Hub's existing person/crew concept. Two people. |
| `login_attempt` | **drop.** `SITE_PASSWORD` and its lockout already cover this. |
| `media_cache` | **keep** as `anime_media`. The JSON `data` column becomes `JSONB`. |
| `entry` | **keep** as `anime_entry`, minus `household_id`. |
| `rotation_slot` | **keep** as `anime_rotation_slot`, minus `household_id`. |
| `changed_at` | **drop.** It exists purely to keep D1's daily row-read quota down. Postgres has no such meter, and Work-Hub's client is not polling every 30 s. |

Deleting `changed_at` and the whole sync outbox is the largest simplification available here. The
local-first sync layer in `src/lib/sync.ts` exists because Kanshou is a PWA talking to an edge
database from two devices. Inside Work-Hub it is one server and one database, so **the entire
newest-wins merge machinery goes away.**

---

## 3. Proposed Postgres schema

Dialect notes for whoever ports the SQL: `?` placeholders become `$1`, `INSERT OR IGNORE` becomes
`ON CONFLICT DO NOTHING`, and `ON CONFLICT … DO UPDATE … WHERE excluded.x > t.x` works unchanged.
Timestamps stop being ISO strings in `TEXT` and become real `timestamptz`.

```sql
CREATE TABLE anime_media (
  id          bigint PRIMARY KEY,            -- AniList id
  type        text NOT NULL DEFAULT 'ANIME', -- ANIME | MANGA
  data        jsonb NOT NULL,                -- title, cover, banner, colour, episodes, genres…
  tmdb_id     bigint,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE anime_entry (
  media_id    bigint PRIMARY KEY REFERENCES anime_media(id),
  status      text NOT NULL CHECK (status IN ('watching','planning','completed','dropped','paused')),
  progress    integer NOT NULL DEFAULT 0,
  started_at  date,
  finished_at date,
  rewatch     boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE anime_rotation_slot (
  position    integer PRIMARY KEY,
  media_id    bigint REFERENCES anime_media(id)
);

-- Phase 3. Ratings and reviews are SEPARATE PER PERSON — decided 2026-10-22, non-negotiable.
CREATE TABLE anime_rating (
  media_id    bigint NOT NULL REFERENCES anime_media(id),
  person_id   text   NOT NULL,            -- Work-Hub's existing person key
  score       numeric(2,1) CHECK (score >= 0.5 AND score <= 5.0),  -- half stars
  review      text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, person_id)
);

-- NEW, and the important one — see §4.
CREATE TABLE anime_episode_log (
  id          bigserial PRIMARY KEY,
  media_id    bigint NOT NULL REFERENCES anime_media(id),
  episode     integer NOT NULL,
  watched_on  date NOT NULL,
  logged_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX anime_episode_log_watched_on ON anime_episode_log (watched_on);
```

Everything above lives in Work-Hub's existing `workhub-db` (SFO3). No new database.

---

## 4. The idea worth building for: one tap, two effects

Home already has an evening planner with an **anime** area and a "✓ I worked on this tonight"
button that earns crew points and keeps the streak.

Kanshou already has a **+1 episode** button.

**These should be the same action.** Tapping +1 on Frieren at 9pm writes a row to
`anime_episode_log` *and* satisfies the evening's anime block. No second button, no logging the
same night twice.

That is what `anime_episode_log` exists for — the current `entry.progress` integer records *where
you are* but not *when you watched*, so it can feed a diary and a rotation but cannot feed a
streak, a "neglected longest" calculation, or a yearly hours stat. The integer stays as the fast
read; the log is the history.

This is also the general pattern for every future area: **an area's primary action is also its
evening log.** Games will work the same way.

---

## 5. What happens to the Cloudflare app

Kanshou stays live and usable for the whole migration. Suggested order, each step independently
reversible:

1. **Build the Home anime area read-only**, against a one-off import of today's Kanshou data.
   Verify the covers, rotation and progress look right.
2. **Make it writable.** Now two apps can write. Keep this window short.
3. **Switch the iPad's home-screen icon** to Work-Hub's `/home`. Kanshou stays deployed.
4. **Freeze Kanshou** — leave it reachable and read-only for a month in case something was missed.
5. **Retire the Worker** when nothing has been missed. The D1 database costs nothing; keep it as
   a cold backup rather than deleting it.

**Export path:** Kanshou already has Save backup / Restore (JSON) in `SettingsSheet.tsx`. That
file is the migration vehicle — write a one-off importer against its shape rather than inventing a
new export.

⚠️ **Do not start Phase 3 (per-person ratings and reviews) in D1.** It is new schema, it is listed
in `CLAUDE.md` as needing a check first, and anything built there has to be ported twice. Build the
log directly in Postgres as part of the Home anime area.

---

## 6. UI

The anime area replaces Kanshou's single page with the same content inside Home:

- **Today's slate** — the rotation, big key art, +1 per show. The existing `SlotCard.tsx` is the
  reference design: accent colour from `coverImage.color`, serif episode numbers, large tap targets.
- **The log** — diary by month, poster grid, both people's half-star ratings side by side.
- **Stats** — episodes, hours, top genres and studios, computed from `anime_episode_log`.

Two things not to lose in translation, both load-bearing:

- **Images come straight from AniList's CDN.** Never proxy or store them. This is why Kanshou
  costs nothing to run and it applies equally on DigitalOcean bandwidth.
- **AniList calls go from the browser**, not the server — their rate limit is ~90 req/min and
  should not be spent from one server IP shared with warehouse traffic.

---

## 7. Where the work happens

Most building is on the home PC. `HOME-CLAUDE.md` already enumerates the home-side files, and that
list is the safety boundary — **touch these and nothing else:**

```
src/model/homeHub.js      src/model/homeEvening.js    src/ingest/homeHub.js
server/queries/homeHub.js server/routes/home.js
client/src/views/Home.jsx  HomeHub.jsx  HomeApp.jsx    client/src/assets/home/
db/schema.sql  (additive migrations only)
```

Never touch NetSuite, warehouse, EDI, Celigo or ShipStation code from home. Never merge a PR or
run `npm run migrate` without Nima saying exactly "Merge it" / "Merge and migrate" for that PR.

**Work-Hub is not currently cloned on the home PC.** First step for any build session:
`gh repo clone nima-cmd/Work-Hub ~/Projects/Work-Hub`.

---

## 8. Open questions — for Nima, not to be guessed

1. **Rotation vs. the evening plan.** Kanshou's rotation is 4 shows a day; Home's planner builds an
   evening from areas. Does the anime block show the whole slate, or tonight's one show?
2. **Does the Kanshou passphrase survive?** Inside Work-Hub everything is behind `SITE_PASSWORD`.
   A second passphrase is probably redundant — confirm it can go.
3. **Who is "person 2"?** `anime_rating.person_id` needs Work-Hub's existing person keys, and
   ratings are per person by decision.
4. **Offline.** Kanshou is a PWA that works on the sofa with bad wifi. Work-Hub is a server app
   behind a password. Is losing offline acceptable? This is the one genuine regression in the move.
5. **Manga, recommendations, where-to-watch** (Kanshou roadmap phases 5–7) — do they come along, or
   does the move cover the diary only for now?

---

## 9. Summary for the work Mac

- Home's job is to suggest and encourage for home life, as Work-Hub does for work. New areas must
  be pluggable.
- Postgres owns diary data. Repos own work product. Home never writes to a repo; if it must, it
  opens a PR.
- Kanshou's `household`, `profile`, `login_attempt`, `changed_at` and the whole sync layer are
  deleted by this move, not ported.
- `anime_episode_log` is new, and makes "+1 episode" double as the evening's anime log.
- Phase 3 must be built in Postgres, not D1.
- The live Cloudflare app stays up until the Home area is proven, then freezes, then retires.
