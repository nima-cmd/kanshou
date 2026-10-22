import { cfEnv, readSession } from "@/server/auth";
import { listProfiles } from "@/server/data";

export async function GET(request: Request) {
  const env = await cfEnv();
  const session = await readSession(env, request);
  if (!session) return Response.json({ authenticated: false });
  const profiles = await listProfiles(env.DB, session.householdId);
  return Response.json({ authenticated: true, profileId: session.profileId, profiles });
}
