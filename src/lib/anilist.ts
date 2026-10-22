// AniList GraphQL client. Calls go straight from the browser (AniList allows
// CORS), so they never count against our host's request quotas, and the rate
// limit (~90 req/min) is per device rather than shared.

const ENDPOINT = "https://graphql.anilist.co";

export type Media = {
  id: number;
  title: string;
  titleNative: string | null;
  cover: string;
  banner: string | null;
  color: string | null;
  episodes: number | null;
  duration: number | null;
  format: string | null;
  status: string | null;
  seasonYear: number | null;
  genres: string[];
  studio: string | null;
  nextEpisode: number | null;
};

type RawMedia = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  episodes: number | null;
  duration: number | null;
  format: string | null;
  status: string | null;
  seasonYear: number | null;
  genres: string[] | null;
  studios: { nodes: { name: string }[] } | null;
  nextAiringEpisode: { episode: number } | null;
};

const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 24) {
    media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      episodes
      duration
      format
      status
      seasonYear
      genres
      studios(isMain: true) { nodes { name } }
      nextAiringEpisode { episode }
    }
  }
}`;

function toMedia(m: RawMedia): Media {
  return {
    id: m.id,
    title: m.title.english ?? m.title.romaji ?? m.title.native ?? "Untitled",
    titleNative: m.title.native,
    cover: m.coverImage.extraLarge ?? m.coverImage.large ?? "",
    banner: m.bannerImage,
    color: m.coverImage.color,
    episodes: m.episodes,
    duration: m.duration,
    format: m.format,
    status: m.status,
    seasonYear: m.seasonYear,
    genres: m.genres ?? [],
    studio: m.studios?.nodes[0]?.name ?? null,
    nextEpisode: m.nextAiringEpisode?.episode ?? null,
  };
}

export class RateLimitError extends Error {}

const searchCache = new Map<string, Media[]>();

export async function searchAnime(query: string, signal?: AbortSignal): Promise<Media[]> {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query.trim() } }),
    signal,
  });
  if (res.status === 429) throw new RateLimitError("AniList rate limit hit");
  if (!res.ok) throw new Error(`AniList error ${res.status}`);

  const json = (await res.json()) as { data: { Page: { media: RawMedia[] } } };
  const results = json.data.Page.media.map(toMedia);
  searchCache.set(key, results);
  return results;
}

/** Episodes we can count toward: the total when known, otherwise what has aired. */
export function knownEpisodes(media: Media): number | null {
  if (media.episodes) return media.episodes;
  if (media.nextEpisode) return media.nextEpisode - 1;
  return null;
}
