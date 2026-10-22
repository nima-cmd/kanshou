# Kanshou — Anime Log & Recommender

> 鑑賞 (kanshō): "appreciation, viewing." A Letterboxd-style anime diary for our household.

## What we're building
A personal anime tracking and recommendation app for two people who watch together. Mainly used on an **iPad**, often while we're watching on Crunchyroll, and also on phones. It should feel like a curated, beautiful anime journal and not a spreadsheet.

## Core features (priority order)
1. **Daily rotation / slate.** We watch **4 anime a day** on a rotation. The home screen shows today's slate. Each show gets a one-tap "+1 episode" button with its progress (ep 7 / 24). The rotation should be easy to reorder and swap.
2. **Progress tracking.** Episode progress per show, plus start and finish dates. A finished show moves to the log.
3. **The log (diary).** A Letterboxd-style diary of completed anime: rating (half stars), short review, date finished, rewatch flag. Also yearly stats (episodes and hours watched, top genres and studios).
4. **Watchlist / Up Next.** A queue of what to start when a slot in the rotation opens. The app suggests the next pick when a show is finished.
5. **Recommendations.** Based on our ratings and history: genre and tag overlap, studios, AniList community recommendations, weighted by our scores. Each rec should come with a one-line "why".
6. **Where to watch.** Our services: Crunchyroll, Prime Video, Disney+, Hulu, Paramount+, Max (HBO), Peacock, Apple TV+. Every title shows which of *our* services has it.
7. **Service advisor.** If several high-scoring recs or watchlist titles are only on a service we don't have (e.g., Netflix), suggest it: "6 titles on your list are only on Netflix." It should consider subscribing for a month and then rotating off.
8. **Manga corner.** For anime we liked, show the source manga (and whether the anime adapted all of it, i.e. "continue the story from chapter X" when known). Also manga recs based on our taste, with official places to read them.

## Tech stack
- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **PWA:** installable on iPad and iPhone via Safari "Add to Home Screen." No App Store needed. Touch-first, tablet layout is the primary design target, with offline-friendly caching.
- **Cloudflare D1 (free tier):** SQLite database so our data syncs across iPad, phones and the desktop. Two user profiles in one shared household; sign-in via Cloudflare Access or a simple household login. (Chosen over Supabase to avoid free-tier pausing and project limits.)
- **AniList GraphQL API** (https://graphql.anilist.co): free and no key needed for public data. It supplies the anime and manga catalog, covers and banners, genres and tags, relations (anime ↔ source manga), community recommendations, and `externalLinks` (streaming sites). Respect the rate limit (~90 req/min, sometimes lower). Cache responses in our DB.
- **TMDB API** (free, non-commercial, key required): `watch/providers` per title for the **US region**. The data is from JustWatch, so attribution to TMDB and JustWatch is required in the UI. Map AniList titles → TMDB IDs by title, year and type, and store the mapping.
- **Hosting:** Cloudflare Pages/Workers free tier (Next.js via the OpenNext Cloudflare adapter). Not Vercel, not DigitalOcean. Never route images through our host: covers load directly from AniList's CDN (`images.unoptimized`).
- **Optional later:** Claude API for written "why you'll like this" recs. It's the only part that costs money, and pennies at our volume.

## Design direction
- Anime-inspired and editorial: big key art and banners, poster grids, a soft dark mode as the default, and accent colors pulled from each show's cover (AniList provides `coverImage.color`).
- Japanese typographic touches (e.g., a subtle 鑑賞 wordmark, episode counts in a display font). Clean, not cluttered or "otaku-forum."
- Large tap targets. It should be usable one-handed on an iPad in a dim room while watching.
- Smooth micro-interactions: a satisfying animation on "+1 episode," a celebration on finishing a series.

## Data model (starting point)
- `household`, `profile`
- `media_cache`: AniList id, type (ANIME/MANGA), title, cover, banner, color, genres, tags, episodes, relations, TMDB id
- `entry`: profile/household, media id, status (watching, planning, completed, dropped, paused), progress, score, review, started_at, finished_at, rewatch
- `rotation_slot`: position 1–4, media id, active
- `services`: which streaming services we have
- `availability_cache`: TMDB id → providers, fetched_at (refresh weekly)

## Not doing (for now)
- No Crunchyroll API scraping. Its API is unofficial and against its ToS. Tracking is done by tapping in our app.
- No App Store release. A PWA is enough.
- No video playback.

## Working agreements for Claude
- Dev machine is **Linux**. Use `pnpm`.
- Keep secrets in `.env.local` (never commit). Maintain `.env.example`.
- Build in small, working vertical slices. Commit after each slice with a clear message.
- Before big architectural decisions, explain the options briefly and ask.
- Keep a `docs/ROADMAP.md` checklist updated as features land.

## Decided (2026-10-22)
- Ratings and reviews are **separate per person**.
- Rotation is **configurable, default 4**.
- History: **import from the Crunchyroll history page** (pasted or saved copy, no scraping).
