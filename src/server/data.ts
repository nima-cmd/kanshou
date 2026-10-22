// D1 reads and writes for the slate. Merges are last-write-wins on updatedAt:
// per entry for progress, and for the rotation as a whole.

import type { Media } from "@/lib/anilist";
import type { Entry, RemoteState, Status } from "@/lib/store";

export type Profile = { id: string; name: string };

export type SyncPayload = {
  entries?: Entry[];
  media?: Media[];
  rotation?: { size: number; slots: (number | null)[]; updatedAt: string };
};

const STATUSES: Status[] = ["watching", "planning", "completed", "dropped", "paused"];
const MAX_ITEMS = 500;
const MAX_MEDIA_BYTES = 16_000;
const isDate = (v: unknown) => v === null || (typeof v === "string" && v.length <= 40);
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

export function validatePayload(body: unknown): SyncPayload {
  if (typeof body !== "object" || body === null) throw new Error("Bad payload");
  const { entries = [], media = [], rotation } = body as SyncPayload;
  if (!Array.isArray(entries) || !Array.isArray(media) || entries.length > MAX_ITEMS || media.length > MAX_ITEMS) {
    throw new Error("Bad payload");
  }
  for (const e of entries) {
    if (
      !isId(e.mediaId) ||
      !STATUSES.includes(e.status) ||
      !Number.isInteger(e.progress) ||
      e.progress < 0 ||
      e.progress > 10_000 ||
      !isDate(e.startedAt) ||
      !isDate(e.finishedAt) ||
      typeof e.updatedAt !== "string"
    ) {
      throw new Error("Bad entry");
    }
  }
  for (const m of media) {
    if (!isId(m.id) || typeof m.title !== "string" || JSON.stringify(m).length > MAX_MEDIA_BYTES) {
      throw new Error("Bad media");
    }
  }
  if (rotation !== undefined) {
    if (
      !Number.isInteger(rotation.size) ||
      rotation.size < 1 ||
      rotation.size > 8 ||
      !Array.isArray(rotation.slots) ||
      rotation.slots.length !== rotation.size ||
      !rotation.slots.every((s) => s === null || isId(s)) ||
      typeof rotation.updatedAt !== "string"
    ) {
      throw new Error("Bad rotation");
    }
  }
  return { entries, media, rotation };
}

export async function ensureHousehold(db: D1Database, householdId: string) {
  await db.prepare("INSERT OR IGNORE INTO household (id) VALUES (?)").bind(householdId).run();
}

export async function listProfiles(db: D1Database, householdId: string): Promise<Profile[]> {
  const { results } = await db
    .prepare("SELECT id, name FROM profile WHERE household_id = ? ORDER BY created_at")
    .bind(householdId)
    .all<Profile>();
  return results;
}

export async function applySync(db: D1Database, householdId: string, payload: SyncPayload) {
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  for (const m of payload.media ?? []) {
    statements.push(
      db
        .prepare(
          `INSERT INTO media_cache (id, type, data, updated_at) VALUES (?, 'ANIME', ?, ?)
           ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        )
        .bind(m.id, JSON.stringify(m), now),
    );
  }

  for (const e of payload.entries ?? []) {
    statements.push(
      db
        .prepare(
          `INSERT INTO entry (household_id, media_id, status, progress, started_at, finished_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (household_id, media_id) DO UPDATE SET
             status = excluded.status, progress = excluded.progress, started_at = excluded.started_at,
             finished_at = excluded.finished_at, updated_at = excluded.updated_at
           WHERE excluded.updated_at > entry.updated_at`,
        )
        .bind(householdId, e.mediaId, e.status, e.progress, e.startedAt, e.finishedAt, e.updatedAt),
    );
  }

  if (payload.rotation) {
    const current = await db
      .prepare("SELECT rotation_updated_at AS at FROM household WHERE id = ?")
      .bind(householdId)
      .first<{ at: string }>();
    if (!current || payload.rotation.updatedAt > current.at) {
      const { size, slots, updatedAt } = payload.rotation;
      statements.push(
        db
          .prepare("UPDATE household SET rotation_size = ?, rotation_updated_at = ? WHERE id = ?")
          .bind(size, updatedAt, householdId),
        db.prepare("DELETE FROM rotation_slot WHERE household_id = ?").bind(householdId),
        ...slots.map((mediaId, position) =>
          db
            .prepare("INSERT INTO rotation_slot (household_id, position, media_id) VALUES (?, ?, ?)")
            .bind(householdId, position, mediaId),
        ),
      );
    }
  }

  if (!statements.length) return;
  statements.push(db.prepare("UPDATE household SET changed_at = ? WHERE id = ?").bind(now, householdId));
  // D1 runs a batch as one transaction.
  await db.batch(statements);
}

type EntryRow = {
  media_id: number;
  status: Status;
  progress: number;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

/** Cheap check (one row read) for whether anything changed since `since`. */
export async function changedSince(db: D1Database, householdId: string, since: string) {
  const row = await db.prepare("SELECT changed_at FROM household WHERE id = ?").bind(householdId).first<{ changed_at: string }>();
  return !row || row.changed_at > since;
}

export async function readState(db: D1Database, householdId: string): Promise<RemoteState> {
  const [household, slots, entries, media] = await db.batch([
    db.prepare("SELECT rotation_size, rotation_updated_at, changed_at FROM household WHERE id = ?").bind(householdId),
    db.prepare("SELECT position, media_id FROM rotation_slot WHERE household_id = ? ORDER BY position").bind(householdId),
    db
      .prepare("SELECT media_id, status, progress, started_at, finished_at, updated_at FROM entry WHERE household_id = ?")
      .bind(householdId),
    db
      .prepare("SELECT m.data FROM media_cache m JOIN entry e ON e.media_id = m.id WHERE e.household_id = ?")
      .bind(householdId),
  ]);

  const h = household.results[0] as
    | { rotation_size: number; rotation_updated_at: string; changed_at: string }
    | undefined;
  const size = h?.rotation_size ?? 4;
  const slotRows = slots.results as { position: number; media_id: number | null }[];
  const slotList: (number | null)[] = Array.from({ length: size }, (_, i) => slotRows.find((r) => r.position === i)?.media_id ?? null);

  return {
    rotationSize: size,
    rotationUpdatedAt: h?.rotation_updated_at ?? "1970-01-01T00:00:00.000Z",
    changedAt: h?.changed_at ?? "1970-01-01T00:00:00.000Z",
    slots: slotList,
    entries: (entries.results as EntryRow[]).map((r) => ({
      mediaId: r.media_id,
      status: r.status,
      progress: r.progress,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      updatedAt: r.updated_at,
    })),
    media: (media.results as { data: string }[]).map((r) => JSON.parse(r.data) as Media),
  };
}
