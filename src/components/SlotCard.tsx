"use client";

import { useState, type CSSProperties } from "react";
import { knownEpisodes, type Media } from "@/lib/anilist";
import { accentFor, inkFor } from "@/lib/color";
import { markFinished, minusOne, moveSlot, plusOne, removeFromRotation, type Entry } from "@/lib/store";

type Props = {
  slot: number;
  slotCount: number;
  media: Media;
  entry: Entry;
  onSwap: () => void;
  onFinished: (media: Media, entry: Entry) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function SlotCard({ slot, slotCount, media, entry, onSwap, onFinished }: Props) {
  const [bumps, setBumps] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const accent = accentFor(media.color);
  const ink = inkFor(accent);
  const total = media.episodes;
  const aired = knownEpisodes(media);
  const pct = aired ? Math.min(100, (entry.progress / aired) * 100) : 0;
  const caughtUp = !total && aired !== null && entry.progress >= aired;

  const handlePlusOne = () => {
    setBumps((b) => b + 1);
    if (plusOne(media.id)) onFinished(media, { ...entry, progress: entry.progress + 1 });
  };

  const handleFinish = () => {
    setMenuOpen(false);
    markFinished(media.id);
    onFinished(media, entry);
  };

  const meta = [media.studio, media.seasonYear, media.format?.replace("_", " ")].filter(Boolean).join(" · ");

  return (
    <article
      className={`relative isolate flex min-h-[300px] rounded-[28px] bg-ink-raised ring-1 ring-ink-line ${menuOpen ? "z-30" : ""}`}
      style={{ "--accent": accent, "--accent-ink": ink } as CSSProperties}
    >
      {/* Key art backdrop, clipped on its own so the options menu can overflow the card */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-[28px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- served directly from AniList's CDN */}
        <img
          src={media.banner ?? media.cover}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover opacity-45 ${media.banner ? "" : "scale-125 blur-2xl"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/30" />
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />
      </div>

      <div className="flex w-full gap-5 p-5 sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- served directly from AniList's CDN */}
        <img
          src={media.cover}
          alt=""
          className="hidden aspect-[2/3] w-28 shrink-0 self-start rounded-2xl object-cover shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:block lg:w-32"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-paper-faint">
                Slot {slot + 1}
              </p>
              <h2 className="mt-1 line-clamp-2 text-xl font-semibold leading-tight text-paper sm:text-2xl">
                {media.title}
              </h2>
              {media.titleNative && (
                <p className="mt-0.5 truncate font-mincho text-sm text-paper-dim">{media.titleNative}</p>
              )}
              {meta && <p className="mt-1 truncate text-sm text-paper-faint">{meta}</p>}
            </div>

            <div className="relative">
              <button
                aria-label="Show options"
                onClick={() => setMenuOpen((o) => !o)}
                className="grid size-12 place-items-center rounded-full bg-white/5 text-2xl leading-none text-paper-dim ring-1 ring-white/10 active:bg-white/15"
              >
                ⋯
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="animate-sheet-in absolute right-0 top-14 z-20 w-56 overflow-hidden rounded-2xl bg-ink-raised py-1 shadow-2xl shadow-black/70 ring-1 ring-ink-line">
                    <MenuItem disabled={slot === 0} onClick={() => { setMenuOpen(false); moveSlot(slot, slot - 1); }}>
                      ← Move earlier
                    </MenuItem>
                    <MenuItem disabled={slot === slotCount - 1} onClick={() => { setMenuOpen(false); moveSlot(slot, slot + 1); }}>
                      Move later →
                    </MenuItem>
                    <MenuItem onClick={() => { setMenuOpen(false); onSwap(); }}>Swap for another show</MenuItem>
                    <MenuItem onClick={handleFinish}>Mark as finished</MenuItem>
                    <MenuItem onClick={() => { setMenuOpen(false); removeFromRotation(slot); }}>
                      Take out of rotation
                    </MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-auto pt-5">
            <div className="flex items-end justify-between gap-3">
              <p className="font-display tabular leading-none">
                <span className="mr-2 align-middle text-sm font-sans uppercase tracking-[0.2em] text-paper-faint">ep</span>
                <span key={bumps} className={`inline-block text-6xl font-semibold text-paper ${bumps ? "animate-bump" : ""}`}>
                  {pad(entry.progress)}
                </span>
                <span className="text-3xl text-paper-faint"> / {total ? pad(total) : "?"}</span>
              </p>
              <p className="pb-1 text-right text-xs text-paper-faint">
                {!total && aired !== null ? (caughtUp ? "Caught up · airing" : `${aired} aired`) : null}
                {total ? `${total - entry.progress} to go` : null}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%`, background: accent }}
              />
            </div>

            <div className="mt-4 flex gap-3">
              <button
                aria-label="Undo one episode"
                onClick={() => minusOne(media.id)}
                disabled={entry.progress === 0}
                className="grid h-20 w-16 shrink-0 place-items-center rounded-2xl bg-white/5 text-2xl text-paper-dim ring-1 ring-white/10 transition active:scale-95 disabled:opacity-30"
              >
                −
              </button>
              <button
                onClick={handlePlusOne}
                disabled={!!total && entry.progress >= total}
                className="relative h-20 flex-1 overflow-hidden rounded-2xl text-2xl font-semibold shadow-lg shadow-black/40 transition active:scale-[0.97] disabled:opacity-40"
                style={{ background: accent, color: ink }}
              >
                {bumps > 0 && (
                  <>
                    <span key={`s${bumps}`} className="animate-sheen absolute inset-y-0 left-0 w-1/3 bg-white/35" />
                    <span key={`f${bumps}`} className="animate-float-up pointer-events-none absolute left-1/2 top-2 font-display text-3xl">
                      +1
                    </span>
                  </>
                )}
                <span className="relative">+1 episode</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function MenuItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="block w-full px-4 py-3.5 text-left text-base text-paper active:bg-white/10 disabled:text-paper-faint/50"
    >
      {children}
    </button>
  );
}

export function EmptySlot({ slot, onAdd }: { slot: number; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="group flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-ink-line text-paper-faint transition active:scale-[0.99] active:border-shu/60"
    >
      <span className="font-mincho text-5xl text-paper-faint/60">空</span>
      <span className="text-xs uppercase tracking-[0.2em]">Slot {slot + 1} is open</span>
      <span className="mt-1 rounded-full bg-white/5 px-6 py-3 text-base font-medium text-paper ring-1 ring-white/10">
        + Add a show
      </span>
    </button>
  );
}
