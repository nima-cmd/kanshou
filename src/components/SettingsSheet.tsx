"use client";

import { useRef, useState } from "react";
import { exportData, importData, MAX_ROTATION, MIN_ROTATION, setRotationSize, type State } from "@/lib/store";

export function SettingsSheet({ state, onClose }: { state: State; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanshou-backup-${new Date().toLocaleDateString("en-CA")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    try {
      importData(await file.text());
      setMessage("Backup restored.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const filled = state.slots.filter((s) => s !== null).length;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="animate-sheet-in w-full max-w-md rounded-[28px] bg-ink-raised p-6 ring-1 ring-ink-line"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">Settings</h2>

        <section className="mt-6">
          <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-paper-faint">Shows per day</h3>
          <div className="mt-3 flex items-center gap-4">
            <button
              aria-label="Fewer shows"
              disabled={state.rotationSize <= MIN_ROTATION}
              onClick={() => setRotationSize(state.rotationSize - 1)}
              className="grid size-14 place-items-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10 active:bg-white/15 disabled:opacity-30"
            >
              −
            </button>
            <span className="w-12 text-center font-display text-4xl tabular">{state.rotationSize}</span>
            <button
              aria-label="More shows"
              disabled={state.rotationSize >= MAX_ROTATION}
              onClick={() => setRotationSize(state.rotationSize + 1)}
              className="grid size-14 place-items-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10 active:bg-white/15 disabled:opacity-30"
            >
              +
            </button>
          </div>
          {filled >= state.rotationSize && state.rotationSize > MIN_ROTATION && (
            <p className="mt-2 text-sm text-paper-faint">Going lower pauses the last show and keeps its progress.</p>
          )}
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-paper-faint">Backup</h3>
          <p className="mt-2 text-sm text-paper-dim">
            Until sync arrives, everything lives on this device only. Save a backup now and then.
          </p>
          <div className="mt-3 flex gap-3">
            <button onClick={download} className="h-14 flex-1 rounded-2xl bg-white/5 ring-1 ring-white/10 active:bg-white/15">
              Save backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="h-14 flex-1 rounded-2xl bg-white/5 ring-1 ring-white/10 active:bg-white/15"
            >
              Restore…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>
          {message && <p className="mt-2 text-sm text-paper-dim">{message}</p>}
        </section>

        <button onClick={onClose} className="mt-8 h-14 w-full rounded-2xl bg-shu font-semibold text-ink">
          Done
        </button>
        <p className="mt-4 text-center text-xs text-paper-faint">Anime data from AniList.</p>
      </div>
    </div>
  );
}
