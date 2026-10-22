"use client";

import { useEffect, useRef, useState } from "react";
import { RateLimitError, searchAnime, type Media } from "@/lib/anilist";
import { accentFor } from "@/lib/color";
import { addToRotation, type State } from "@/lib/store";

type Props = {
  state: State;
  /** Slot to fill or replace. When unset, the first open slot is used. */
  targetSlot: number | null;
  onClose: () => void;
};

export function SearchSheet({ state, targetSlot, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Media | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    // Debounce so typing doesn't burn through AniList's rate limit.
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await searchAnime(q, controller.signal));
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(
          e instanceof RateLimitError
            ? "AniList asked us to slow down. Try again in a minute."
            : "Couldn't reach AniList. Check the connection and try again.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const openSlot = state.slots.indexOf(null);

  const choose = (media: Media) => {
    if (targetSlot !== null || openSlot >= 0) {
      addToRotation(media, targetSlot ?? openSlot);
      onClose();
    } else {
      setPending(media); // rotation is full: ask which show to swap out
    }
  };

  const showResults = query.trim().length >= 2;
  const replacing = targetSlot !== null ? state.slots[targetSlot] : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink/95 backdrop-blur-xl">
      <div className="animate-sheet-in mx-auto flex h-full w-full max-w-5xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex items-center gap-3 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search AniList…"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="off"
            className="h-16 min-w-0 flex-1 rounded-2xl bg-ink-raised px-5 text-xl text-paper ring-1 ring-ink-line placeholder:text-paper-faint focus:outline-none focus:ring-2 focus:ring-shu/70"
          />
          <button
            onClick={onClose}
            className="h-16 shrink-0 rounded-2xl px-5 text-lg text-paper-dim active:bg-white/10"
          >
            Cancel
          </button>
        </div>
        <p className="pb-3 text-sm text-paper-faint">
          {replacing
            ? `Swapping out ${state.media[replacing]?.title ?? "this show"} (its progress is kept).`
            : targetSlot !== null
              ? `Adding to slot ${targetSlot + 1}.`
              : openSlot >= 0
                ? `Adding to slot ${openSlot + 1}.`
                : "Rotation is full. You'll pick a show to swap out."}
        </p>

        <div className="flex-1 overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {error && <p className="py-10 text-center text-paper-dim">{error}</p>}
          {!error && showResults && !loading && results.length === 0 && (
            <p className="py-10 text-center text-paper-dim">No anime found for “{query.trim()}”.</p>
          )}
          {!showResults && (
            <p className="py-16 text-center font-mincho text-2xl text-paper-faint/70">何を観る？</p>
          )}
          <ul className={`grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 ${loading ? "opacity-60" : ""}`}>
            {showResults &&
              results.map((m) => {
                const inRotation = state.slots.includes(m.id);
                const entry = state.entries[m.id];
                return (
                  <li key={m.id}>
                    <button onClick={() => choose(m)} className="group block w-full text-left active:scale-[0.97]">
                      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink-raised ring-1 ring-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element -- served directly from AniList's CDN */}
                        <img src={m.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: accentFor(m.color) }} />
                        {(inRotation || entry) && (
                          <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-medium text-paper">
                            {inRotation ? "In rotation" : entry.status === "completed" ? "Finished" : `Ep ${entry.progress}`}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-paper">{m.title}</p>
                      <p className="text-xs text-paper-faint">
                        {[m.seasonYear, m.episodes ? `${m.episodes} eps` : m.status === "RELEASING" ? "Airing" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={() => setPending(null)}>
          <div
            className="animate-sheet-in w-full max-w-md rounded-3xl bg-ink-raised p-6 ring-1 ring-ink-line"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Swap out which show?</h3>
            <p className="mt-1 text-sm text-paper-dim">
              {pending.title} takes its slot. The other show is paused with its progress kept.
            </p>
            <div className="mt-4 space-y-2">
              {state.slots.map((id, i) =>
                id === null ? null : (
                  <button
                    key={i}
                    onClick={() => {
                      addToRotation(pending, i);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left active:bg-white/15"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- served directly from AniList's CDN */}
                    <img src={state.media[id]?.cover} alt="" className="h-14 w-10 rounded-md object-cover" />
                    <span className="flex-1 truncate">{state.media[id]?.title}</span>
                    <span className="text-sm text-paper-faint">Ep {state.entries[id]?.progress ?? 0}</span>
                  </button>
                ),
              )}
            </div>
            <button onClick={() => setPending(null)} className="mt-4 h-12 w-full rounded-2xl text-paper-dim active:bg-white/10">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
