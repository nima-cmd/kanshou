"use client";

// Local-first storage: one JSON document in localStorage, so taps are instant
// and the app keeps working offline. Every change also lands in an outbox that
// src/lib/sync.ts pushes to D1; the server's merged state then comes back here.

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
  /** When the rotation (slots or size) last changed; decides sync conflicts. */
  rotationUpdatedAt?: string;
  /** Server's change stamp as of the last sync; lets idle polls skip the full read. */
  syncedAt?: string;
  entries: Record<string, Entry>;
  media: Record<string, Media>;
};

export const MIN_ROTATION = 1;
export const MAX_ROTATION = 8;
const KEY = "kanshou:v1";
const OUTBOX_KEY = "kanshou:outbox";

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
  const before = read();
  const draft = structuredClone(before);
  fn(draft);

  // Queue whatever changed for the next sync.
  const outbox = readOutbox();
  for (const [id, entry] of Object.entries(draft.entries)) {
    if (before.entries[id]?.updatedAt !== entry.updatedAt) outbox.entries[id] = ++outbox.seq;
  }
  if (draft.rotationSize !== before.rotationSize || JSON.stringify(draft.slots) !== JSON.stringify(before.slots)) {
    draft.rotationUpdatedAt = now();
    outbox.rotation = ++outbox.seq;
  }
  writeOutbox(outbox);
  write(draft);
  changeListener?.();
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

/** Jumps to an episode, e.g. for a show started elsewhere. Returns true when that finished the series. */
export function setProgress(mediaId: number, episode: number): boolean {
  let finished = false;
  update((s) => {
    const entry = s.entries[mediaId];
    const media = s.media[mediaId];
    if (!entry || !media) return;
    const total = media.episodes;
    const next = Math.max(0, Math.min(total ?? Infinity, Math.round(episode)));
    if (next === entry.progress) return;

    entry.progress = next;
    if (next > 0) entry.startedAt ??= today();
    entry.updatedAt = now();
    if (total && next >= total) {
      finish(s, mediaId);
      finished = true;
    }
  });
  return finished;
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
  // A restored backup should win over what's synced, so stamp it as newest.
  const stamp = now();
  for (const entry of Object.values(parsed.entries)) entry.updatedAt = stamp;
  parsed.rotationUpdatedAt = stamp;
  write(parsed);
  queueEverything(true);
  changeListener?.();
}

// ---- Sync outbox ----

/** Entry ids (and the rotation) changed locally, each with a change counter. */
export type Outbox = { seq: number; entries: Record<string, number>; rotation: number };

function readOutbox(): Outbox {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (raw) return JSON.parse(raw) as Outbox;
  } catch {}
  return { seq: 0, entries: {}, rotation: 0 };
}

function writeOutbox(outbox: Outbox) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch {}
}

let changeListener: (() => void) | null = null;

/** Lets the sync engine hear about local changes. */
export function onLocalChange(listener: () => void) {
  changeListener = listener;
}

export function lastSyncedAt() {
  return read().syncedAt;
}

export function hasPending() {
  const o = readOutbox();
  return o.rotation > 0 || Object.keys(o.entries).length > 0;
}

/** What to send: the outbox snapshot plus the data it points at. */
export function takeOutbox() {
  const s = read();
  const outbox = readOutbox();
  const entries = Object.keys(outbox.entries)
    .map((id) => s.entries[id])
    .filter(Boolean);
  const media = entries.map((e) => s.media[e.mediaId]).filter(Boolean);
  const rotation =
    outbox.rotation > 0 ? { size: s.rotationSize, slots: s.slots, updatedAt: s.rotationUpdatedAt ?? now() } : undefined;
  return { sent: outbox, payload: { entries, media, rotation } };
}

/**
 * Queues local data for upload, used when a device first links to the household.
 * The rotation only goes up when the server has none, so a second device
 * adopts the household's slate instead of overwriting it.
 */
export function queueEverything(includeRotation: boolean) {
  const s = read();
  const outbox = readOutbox();
  for (const id of Object.keys(s.entries)) outbox.entries[id] = ++outbox.seq;
  if (includeRotation && s.slots.some((id) => id !== null)) {
    if (!s.rotationUpdatedAt) write({ ...s, rotationUpdatedAt: now() });
    outbox.rotation = ++outbox.seq;
  }
  writeOutbox(outbox);
}

export type RemoteState = {
  rotationSize: number;
  rotationUpdatedAt: string;
  changedAt: string;
  slots: (number | null)[];
  entries: Entry[];
  media: Media[];
};

/**
 * Adopts the server's state, except for anything changed locally while the
 * request was in flight; that stays queued for the next sync.
 */
export function applyRemote(remote: RemoteState, sent: Outbox) {
  const local = read();
  const outbox = readOutbox();

  const next: State = {
    version: 1,
    rotationSize: remote.rotationSize,
    slots: remote.slots,
    rotationUpdatedAt: remote.rotationUpdatedAt,
    syncedAt: remote.changedAt,
    entries: Object.fromEntries(remote.entries.map((e) => [e.mediaId, e])),
    media: { ...local.media, ...Object.fromEntries(remote.media.map((m) => [m.id, m])) },
  };

  for (const [id, seq] of Object.entries(outbox.entries)) {
    if (sent.entries[id] === seq) delete outbox.entries[id];
    else if (local.entries[id]) next.entries[id] = local.entries[id];
  }
  if (outbox.rotation > 0) {
    if (sent.rotation === outbox.rotation) outbox.rotation = 0;
    else {
      next.rotationSize = local.rotationSize;
      next.slots = local.slots;
      next.rotationUpdatedAt = local.rotationUpdatedAt;
    }
  }

  writeOutbox(outbox);
  write(next);
}
