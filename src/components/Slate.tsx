"use client";

import { useEffect, useState } from "react";
import type { Media } from "@/lib/anilist";
import { useKanshou, type Entry } from "@/lib/store";
import { startSync, useSync } from "@/lib/sync";
import { Celebration } from "./Celebration";
import { SearchSheet } from "./SearchSheet";
import { SettingsSheet } from "./SettingsSheet";
import { SignIn } from "./SignIn";
import { SyncDot } from "./SyncDot";
import { EmptySlot, SlotCard } from "./SlotCard";

type Search = { slot: number | null } | null;

/** Only rendered once the store has loaded on the device, never at prerender. */
function Today() {
  return <>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</>;
}

export function Slate() {
  const sync = useSync();
  if (sync && (!sync.account || sync.status === "signed-out")) return <SignIn />;
  return <SignedInSlate />;
}

function SignedInSlate() {
  const state = useKanshou();
  useEffect(startSync, []);
  const [search, setSearch] = useState<Search>(null);
  const [settings, setSettings] = useState(false);
  const [finished, setFinished] = useState<{ media: Media; entry: Entry; slot: number } | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
      <header className="flex items-center gap-4 py-4">
        <div className="flex items-baseline gap-3">
          <span className="whitespace-nowrap font-mincho text-4xl font-semibold text-paper">鑑賞</span>
          <span className="hidden text-sm uppercase tracking-[0.3em] text-paper-faint sm:inline">Kanshou</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SyncDot />
          <button
            onClick={() => setSearch({ slot: null })}
            className="h-12 whitespace-nowrap rounded-full bg-shu px-5 font-semibold text-ink active:scale-95"
          >
            + Add show
          </button>
          <button
            aria-label="Settings"
            onClick={() => setSettings(true)}
            className="grid size-12 place-items-center rounded-full bg-white/5 text-xl text-paper-dim ring-1 ring-white/10 active:bg-white/15"
          >
            ⚙︎
          </button>
        </div>
      </header>

      <div className="mb-6 mt-2">
        <p className="h-5 text-sm text-paper-faint">{state && <Today />}</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Today’s slate</h1>
      </div>

      {state === null ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="min-h-[300px] animate-pulse rounded-[28px] bg-ink-raised" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {state.slots.map((id, slot) => {
            const media = id !== null ? state.media[id] : undefined;
            const entry = id !== null ? state.entries[id] : undefined;
            return media && entry ? (
              <SlotCard
                key={id}
                slot={slot}
                slotCount={state.slots.length}
                media={media}
                entry={entry}
                onSwap={() => setSearch({ slot })}
                onFinished={(m, e) => setFinished({ media: m, entry: e, slot })}
              />
            ) : (
              <EmptySlot key={`empty-${slot}`} slot={slot} onAdd={() => setSearch({ slot })} />
            );
          })}
        </div>
      )}

      {state && search && <SearchSheet state={state} targetSlot={search.slot} onClose={() => setSearch(null)} />}
      {state && settings && <SettingsSheet state={state} onClose={() => setSettings(false)} />}
      {finished && (
        <Celebration
          media={finished.media}
          entry={finished.entry}
          onClose={() => setFinished(null)}
          onPickNext={() => {
            setSearch({ slot: finished.slot });
            setFinished(null);
          }}
        />
      )}
    </div>
  );
}
