import { cfEnv, readSession, unauthorized } from "@/server/auth";
import { applySync, changedSince, readState, validatePayload } from "@/server/data";

/** Current household state, or `{ unchanged: true }` when nothing changed since `?since=`. */
export async function GET(request: Request) {
  const env = await cfEnv();
  const session = await readSession(env, request);
  if (!session) return unauthorized();
  const since = new URL(request.url).searchParams.get("since");
  if (since && !(await changedSince(env.DB, session.householdId, since))) {
    return Response.json({ unchanged: true });
  }
  return Response.json(await readState(env.DB, session.householdId));
}

/** Push local changes (last write wins), get the merged state back. */
export async function POST(request: Request) {
  const env = await cfEnv();
  const session = await readSession(env, request);
  if (!session) return unauthorized();

  let payload;
  try {
    payload = validatePayload(await request.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Bad payload" }, { status: 400 });
  }
  await applySync(env.DB, session.householdId, payload);
  return Response.json(await readState(env.DB, session.householdId));
}
