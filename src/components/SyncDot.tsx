"use client";

import { useSync } from "@/lib/sync";

const LABELS = {
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline. Changes will sync when you're back online.",
  "signed-out": "Signed out",
} as const;

/** A quiet status light: green synced, pulsing while syncing, amber offline. */
export function SyncDot() {
  const sync = useSync();
  if (!sync?.account) return null;
  const color =
    sync.status === "offline" ? "bg-amber-400" : sync.status === "syncing" ? "bg-paper-faint animate-pulse" : "bg-emerald-400";
  return (
    <span title={LABELS[sync.status]} aria-label={LABELS[sync.status]} role="status" className="grid size-12 place-items-center">
      <span className={`size-2.5 rounded-full ${color}`} />
    </span>
  );
}
