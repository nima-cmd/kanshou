# Kanshou 鑑賞

Our household anime diary: today's slate, episode progress, and (soon) the log.
See [CLAUDE.md](CLAUDE.md) for the vision and [docs/ROADMAP.md](docs/ROADMAP.md) for progress.

## Run it

```bash
pnpm install
pnpm dev            # this computer only: http://localhost:3000
pnpm ipad           # production build, reachable from the iPad and phones on home Wi-Fi
```

### On the iPad (same Wi-Fi)
1. On the computer, run `pnpm ipad`. If macOS asks whether `node` may accept incoming connections, click **Allow**.
2. On the iPad, open Safari and go to `http://<computer-name>.local:3000` (for example `http://Nimas-iMac.local:3000`).
   The `.local` name stays the same when the router hands out a new IP. Your data is tied to that address, so always use the same one.
3. Tap Share → **Add to Home Screen**. Kanshou now opens full screen from its own icon.

Notes for Phase 1:
- Data lives in each device's browser storage. The iPad and phones don't sync yet (that's Phase 2). Use Settings → **Save backup** now and then.
- The Home Screen app and a Safari tab keep separate storage on iOS. Pick one, ideally the Home Screen app.
- Offline caching needs HTTPS, so it only turns on after we deploy to Cloudflare. On home Wi-Fi the app works but needs the computer running.

## Data sources
Anime data and images from [AniList](https://anilist.co). Images load directly from AniList's CDN and never pass through our host.
