"use client";

// Phase 1 storage: one JSON document in localStorage. The shape mirrors the
// planned D1 tables (entry, rotation_slot, media_cache) so Phase 2 can migrate
// it with a straight copy.

import { useSyncExternalStore } from "react";
import { knownEpisodes, type Media } from "./anilist";

export type Status = "watching" | "planning" | "completed" | "dropped" | "paused";

export type Entry = {
  mediaId: number;
  status: Status;
  progress: number;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type State = {
  version: 1;
  rotationSize: number;
  /** Media id per rotation position; null is an open slot. */
  slots: (number | null)[];
  entries: Record<string, Entry>;
  media: Record<string, Media>;
};

export const MIN_ROTATION = 1;
export const MAX_ROTATION = 8;
const KEY = "kanshou:v1";

const emptyState = (): State => ({
  version: 1,
  rotationSize: 4,
  slots: [null, null, null, null],
  entries: {},
  media: {},
});

let current: State | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as State) : emptyState();
  } catch {
    current = emptyState();
  }
  return current;
}

function write(next: State) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode): keep working in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Returns null during server render and before hydration. */
export function useKanshou(): State | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

const now = () => new Date().toISOString();
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

function update(fn: (draft: State) => void) {
  const draft = structuredClone(read());
  fn(draft);
  write(draft);
}

export function addToRotation(media: Media, slot?: number) {
  update((s) => {
    s.media[media.id] = media;
    const target = slot ?? s.slots.findIndex((id) => id === null);
    if (target < 0) return;

    // A show can only hold one slot.
    const existing = s.slots.indexOf(media.id);
    if (existing >= 0) s.slots[existing] = null;

    const displaced = s.slots[target];
    if (displaced !== null && displaced !== media.id) setStatus(s, displaced, "paused");
    s.slots[target] = media.id;

    const entry = s.entries[media.id];
    if (!entry || entry.status === "completed") {
      s.entries[media.id] = {
        mediaId: media.id,
        status: "watching",
        progress: 0,
        startedAt: null,
        finishedAt: null,
        updatedAt: now(),
      };
    } else {
      setStatus(s, media.id, "watching");
    }
  });
}

function setStatus(s: State, mediaId: number, status: Status) {
  const entry = s.entries[mediaId];
  if (entry) {
    entry.status = status;
    entry.updatedAt = now();
  }
}

/** Adds one episode. Returns true when that episode finished the series. */
export function plusOne(mediaId: number): boolean {
  let finished = false;
  update((s) => {
    const entry = s.entries[mediaId];
    const media = s.media[mediaId];
    if (!entry || !media) return;
    const total = media.episodes;
    if (total && entry.progress >= total) return;

    entry.progress += 1;
    entry.startedAt ??= today();
    entry.updatedAt = now();
    if (total && entry.progress >= total) {
      finish(s, mediaId);
      finished = true;
    }
  });
  return finished;
}

export function minusOne(mediaId: number) {
  update((s) => {
    const entry = s.entries[mediaId];
    if (!entry || entry.progress === 0) return;
    entry.progress -= 1;
    entry.updatedAt = now();
  });
}

function finish(s: State, mediaId: number) {
  const entry = s.entries[mediaId];
  if (!entry) return;
  entry.status = "completed";
  entry.finishedAt = today();
  entry.updatedAt = now();
  const media = s.media[mediaId];
  const total = media && knownEpisodes(media);
  if (total && entry.progress < total) entry.progress = total;
  const slot = s.slots.indexOf(mediaId);
  if (slot >= 0) s.slots[slot] = null;
}

export function markFinished(mediaId: number) {
  update((s) => finish(s, mediaId));
}

/** Takes a show out of the rotation, keeping its progress. */
export function removeFromRotation(slot: number) {
  update((s) => {
    const id = s.slots[slot];
    if (id === null || id === undefined) return;
    s.slots[slot] = null;
    setStatus(s, id, "paused");
  });
}

export function moveSlot(from: number, to: number) {
  update((s) => {
    if (to < 0 || to >= s.slots.length) return;
    [s.slots[from], s.slots[to]] = [s.slots[to], s.slots[from]];
  });
}

export function setRotationSize(size: number) {
  update((s) => {
    const n = Math.max(MIN_ROTATION, Math.min(MAX_ROTATION, size));
    // Shrinking keeps shows: open slots go first, then trailing shows pause.
    while (s.slots.length > n) {
      const openIndex = s.slots.lastIndexOf(null);
      const [removed] = s.slots.splice(openIndex >= 0 ? openIndex : s.slots.length - 1, 1);
      if (removed !== null) setStatus(s, removed, "paused");
    }
    while (s.slots.length < n) s.slots.push(null);
    s.rotationSize = n;
  });
}

export function exportData(): string {
  return JSON.stringify(read(), null, 2);
}

export function importData(json: string) {
  const parsed = JSON.parse(json) as State;
  if (parsed.version !== 1 || !Array.isArray(parsed.slots) || typeof parsed.entries !== "object") {
    throw new Error("This doesn't look like a Kanshou backup.");
  }
  write(parsed);
}
