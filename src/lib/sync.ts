"use client";

// Sync engine: pushes the outbox to /api/sync and adopts the merged state.
// It runs shortly after each change, when the app comes back to the
// foreground or back online, and every 30 s while the app is on screen.
// A day of two people watching is a few hundred requests, far below the
// Workers free plan's 100k/day, and idle polls read a single D1 row.

import { useSyncExternalStore } from "react";
import { applyRemote, hasPending, lastSyncedAt, onLocalChange, queueEverything, takeOutbox, type RemoteState } from "./store";

export type Account = { profileId: string; name: string };
export type SyncStatus = "idle" | "syncing" | "offline" | "signed-out";

const ACCOUNT_KEY = "kanshou:account";
const DEBOUNCE_MS = 800;
const POLL_MS = 30_000;

type Snapshot = { status: SyncStatus; lastSyncedAt: number | null; account: Account | null };

let snapshot: Snapshot = { status: "idle", lastSyncedAt: null, account: null };
let loaded = false;
const listeners = new Set<() => void>();

function set(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function getSnapshot(): Snapshot {
  if (!loaded) {
    loaded = true;
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      snapshot = { ...snapshot, account: raw ? (JSON.parse(raw) as Account) : null };
    } catch {}
  }
  return snapshot;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Null until hydrated on the device. */
export function useSync(): Snapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function setAccount(account: Account | null) {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {}
  set({ account, status: account ? "idle" : "signed-out" });
}

let inFlight: Promise<void> | null = null;
let again = false;

export async function syncNow(): Promise<void> {
  if (!getSnapshot().account) return;
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = (async () => {
    set({ status: "syncing" });
    try {
      const { sent, payload } = takeOutbox();
      const pending = hasPending();
      const since = lastSyncedAt();
      const url = !pending && since ? `/api/sync?since=${encodeURIComponent(since)}` : "/api/sync";
      const res = await fetch(url, {
        method: pending ? "POST" : "GET",
        headers: pending ? { "Content-Type": "application/json" } : undefined,
        body: pending ? JSON.stringify(payload) : undefined,
        credentials: "same-origin",
      });
      if (res.status === 401) {
        // Keep the local data; it syncs again after signing back in.
        set({ status: "signed-out" });
        return;
      }
      if (!res.ok) throw new Error(`sync ${res.status}`);
      const body = (await res.json()) as RemoteState | { unchanged: true };
      if (!("unchanged" in body)) applyRemote(body, sent);
      set({ status: "idle", lastSyncedAt: Date.now() });
    } catch {
      set({ status: "offline" });
    }
  })();
  await inFlight;
  inFlight = null;
  if (again) {
    again = false;
    await syncNow();
  }
}

/** First sign-in on a device: upload what it has, merged with what the household has. */
export async function linkDevice(account: Account) {
  setAccount(account);
  const res = await fetch("/api/sync", { credentials: "same-origin" });
  if (res.ok) {
    const remote = (await res.json()) as RemoteState;
    const householdIsEmpty = remote.entries.length === 0 && remote.slots.every((s) => s === null);
    queueEverything(householdIsEmpty);
  }
  await syncNow();
}

let started = false;

export function startSync() {
  if (started) return;
  started = true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  onLocalChange(() => {
    clearTimeout(timer);
    timer = setTimeout(syncNow, DEBOUNCE_MS);
  });

  const visible = () => document.visibilityState === "visible";
  document.addEventListener("visibilitychange", () => visible() && syncNow());
  window.addEventListener("online", () => syncNow());
  setInterval(() => visible() && syncNow(), POLL_MS);
  syncNow();
}
