import { cfEnv, readSession, sessionCookie, unauthorized } from "@/server/auth";
import { listProfiles } from "@/server/data";

const MAX_PROFILES = 4;

/** Creates a profile (or picks an existing one by id) and binds this device's session to it. */
export async function POST(request: Request) {
  const env = await cfEnv();
  const session = await readSession(env, request);
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; id?: unknown };
  const profiles = await listProfiles(env.DB, session.householdId);
  let profileId: string;

  if (typeof body.id === "string") {
    if (!profiles.some((p) => p.id === body.id)) return Response.json({ error: "No such profile" }, { status: 404 });
    profileId = body.id;
  } else {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    if (!name) return Response.json({ error: "Pick a name" }, { status: 400 });
    if (profiles.length >= MAX_PROFILES) return Response.json({ error: "That's enough profiles" }, { status: 400 });
    profileId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO profile (id, household_id, name) VALUES (?, ?, ?)")
      .bind(profileId, session.householdId, name)
      .run();
  }

  const cookie = await sessionCookie(env, request, { householdId: session.householdId, profileId });
  return Response.json(
    { profileId, profiles: await listProfiles(env.DB, session.householdId) },
    { headers: { "Set-Cookie": cookie } },
  );
}
