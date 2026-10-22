"use client";

import { useMemo, type CSSProperties } from "react";
import type { Media } from "@/lib/anilist";
import { accentFor } from "@/lib/color";
import type { Entry } from "@/lib/store";

type Props = {
  media: Media;
  entry: Entry;
  onPickNext: () => void;
  onClose: () => void;
};

const formatDate = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

export function Celebration({ media, entry, onPickNext, onClose }: Props) {
  const accent = accentFor(media.color);

  const pieces = useMemo(() => {
    const colors = [accent, "#e0573d", "#efe9df", "#f2c14e"];
    // Deterministic per show, so the burst is stable across re-renders.
    const rand = (i: number, k: number) => {
      const x = Math.sin(media.id * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: 70 }, (_, i) => ({
      left: `${rand(i, 0) * 100}%`,
      color: colors[i % colors.length],
      size: 6 + rand(i, 1) * 8,
      style: {
        "--drift": `${(rand(i, 2) - 0.5) * 30}vw`,
        "--spin": `${360 + rand(i, 3) * 720}deg`,
        "--dur": `${2.2 + rand(i, 4) * 1.8}s`,
        "--delay": `${rand(i, 5) * 0.5}s`,
      } as CSSProperties,
    }));
  }, [accent, media.id]);

  const started = formatDate(entry.startedAt);
  const finished = formatDate(new Date().toLocaleDateString("en-CA"));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink/90 p-6 backdrop-blur-md" onClick={onClose}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti pointer-events-none absolute top-0 rounded-[2px]"
          style={{ ...p.style, left: p.left, width: p.size, height: p.size * 1.6, background: p.color }}
        />
      ))}

      <div
        className="animate-sheet-in relative w-full max-w-md rounded-[32px] bg-ink-raised p-8 text-center ring-1 ring-ink-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto w-40">
          {/* eslint-disable-next-line @next/next/no-img-element -- served directly from AniList's CDN */}
          <img src={media.cover} alt="" className="aspect-[2/3] w-full rounded-2xl object-cover shadow-2xl shadow-black/70" />
          <span
            className="animate-stamp absolute -right-8 -top-6 grid size-20 place-items-center rounded-full border-4 font-mincho text-4xl font-bold"
            style={{ borderColor: "#e0573d", color: "#e0573d", background: "rgba(14,13,19,0.85)" }}
          >
            完
          </span>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.25em] text-paper-faint">Series complete</p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight">{media.title}</h2>
        <p className="mt-2 text-sm text-paper-dim">
          {[entry.progress ? `${entry.progress} episodes` : null, started && `${started} → ${finished}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <button
          onClick={onPickNext}
          className="mt-6 h-16 w-full rounded-2xl text-lg font-semibold"
          style={{ background: accent, color: "#14121a" }}
        >
          Pick the next show
        </button>
        <button onClick={onClose} className="mt-2 h-12 w-full rounded-2xl text-paper-dim active:bg-white/10">
          Later
        </button>
      </div>
    </div>
  );
}
