"use client";

import { useEffect, useRef } from "react";
import { knownEpisodes, type Media } from "@/lib/anilist";
import { setProgress, type Entry } from "@/lib/store";

type Props = {
  media: Media;
  entry: Entry;
  onClose: () => void;
  onFinished: (media: Media, entry: Entry) => void;
};

/** Pick the last episode watched, for shows started outside the app or missed taps. */
export function EpisodeSheet({ media, entry, onClose, onFinished }: Props) {
  const currentRef = useRef<HTMLButtonElement>(null);
  // Unknown length (airing, no count yet): list a little past where we are.
  const count = knownEpisodes(media) ?? entry.progress + 12;
  const episodes = Array.from({ length: count + 1 }, (_, i) => i);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const pick = (episode: number) => {
    onClose();
    if (setProgress(media.id, episode)) onFinished(media, { ...entry, progress: episode });
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="animate-sheet-in flex max-h-[80vh] w-full max-w-md flex-col rounded-[28px] bg-ink-raised ring-1 ring-ink-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-3">
          <h2 className="line-clamp-2 text-xl font-semibold">{media.title}</h2>
          <p className="mt-1 text-sm text-paper-faint">Tap the last episode you finished.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {episodes.map((n) => {
            const current = n === entry.progress;
            return (
              <button
                key={n}
                ref={current ? currentRef : undefined}
                onClick={() => pick(n)}
                className={`flex w-full items-baseline gap-4 rounded-2xl px-4 py-4 text-left active:bg-white/10 ${
                  current ? "bg-white/10 ring-1 ring-white/15" : ""
                }`}
              >
                <span className="w-10 shrink-0 font-display text-2xl tabular text-paper">
                  {n === 0 ? "–" : String(n).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-base text-paper-dim">
                  {n === 0 ? "Not started" : `Episode ${n}`}
                </span>
                {current && <span className="text-xs uppercase tracking-[0.2em] text-paper-faint">Now</span>}
              </button>
            );
          })}
        </div>

        <div className="p-6 pt-3">
          <button onClick={onClose} className="h-14 w-full rounded-2xl bg-white/5 ring-1 ring-white/10 active:bg-white/15">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
