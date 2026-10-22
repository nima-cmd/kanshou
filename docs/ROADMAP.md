# Kanshou Roadmap

Small vertical slices. Each phase ends with something we use for real.

## Phase 1: Local MVP (this device only)
- [x] Next.js (App Router) + TypeScript + Tailwind, pnpm
- [x] Installable PWA (manifest, icons, service worker, iPad "Add to Home Screen")
- [x] AniList search (client-side, cached)
- [x] Daily rotation (default 4, configurable 1–8): add, remove, reorder, swap
- [x] Big "+1 episode" button with progress (ep 7 / 24) and animation
- [x] Start and finish dates; finishing a show celebrates and moves it out of the rotation
- [x] Data in localStorage, with JSON export/import as a backup
- [x] Dark, iPad-first layout with cover-color accents
- [ ] Offline caching on the iPad (the service worker is built; it needs HTTPS, so it turns on with the Phase 2 deploy)

## Phase 2: Sync between our devices
- [ ] Cloudflare Pages + D1 (Next.js via the OpenNext Cloudflare adapter)
- [ ] Household with two profiles, sign-in (Cloudflare Access or a household login)
- [ ] Move localStorage data to the DB (one-time migration)
- [ ] Deploy, so it works away from home Wi-Fi

## Phase 3: The log
- [ ] Completed shows: half-star rating and short review **per person**, finish date, rewatch flag
- [ ] Import Crunchyroll history: paste or upload a saved copy of the history page, match titles to AniList, review before saving (no scraping)
- [ ] Diary view (by month) and poster grid
- [ ] Yearly stats: episodes, hours, top genres and studios

## Phase 4: Watchlist / Up Next
- [ ] Queue of shows to start
- [ ] When a show finishes, suggest the next pick for the open slot

## Phase 5: Where to watch + service advisor
- [ ] TMDB `watch/providers` (US), AniList → TMDB mapping stored
- [ ] Badges for our services on every title; TMDB and JustWatch attribution
- [ ] Advisor: "6 titles on your list are only on Netflix — try a month, then rotate off"

## Phase 6: Recommendations
- [ ] Score by genre/tag/studio overlap and AniList community recs, weighted by our ratings
- [ ] One-line "why" per rec
- [ ] Optional: Claude-written explanations

## Phase 7: Manga corner
- [ ] Source manga for anime we liked, with "continue from chapter X" when known
- [ ] Manga recs and official places to read

## Decisions (2026-10-22)
- Ratings and reviews are separate per person.
- Rotation size is configurable and defaults to 4.
- History comes from a Crunchyroll history import (Phase 3).
- Hosting: Cloudflare Pages + D1, not Vercel + Supabase and not DigitalOcean.

## Hosting and caps
Goal: no surprise caps at two-person scale. Cloudflare doesn't pause inactive projects and doesn't cap static bandwidth.
Rules that keep us far under every quota:
- Cover and banner images load straight from AniList's CDN. No image optimization through our host, and no image storage in our DB.
- The DB holds only small metadata (entries, cached titles, availability). Years of use for two people should stay in the low tens of MB.
- AniList calls go from the browser and get cached, so they don't use our server quotas.
