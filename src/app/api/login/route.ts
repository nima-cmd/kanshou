import {
  HOUSEHOLD_ID,
  cfEnv,
  clientIp,
  isLockedOut,
  passphraseMatches,
  recordFailedLogin,
  sessionCookie,
} from "@/server/auth";
import { ensureHousehold, listProfiles } from "@/server/data";

export async function POST(request: Request) {
  const env = await cfEnv();
  const ip = clientIp(request);
  if (await isLockedOut(env, ip)) {
    return Response.json({ error: "Too many tries. Wait 15 minutes and try again." }, { status: 429 });
  }

  const { passphrase } = (await request.json().catch(() => ({}))) as { passphrase?: unknown };
  if (typeof passphrase !== "string" || !(await passphraseMatches(env, passphrase))) {
    await recordFailedLogin(env, ip);
    return Response.json({ error: "That passphrase isn't right." }, { status: 401 });
  }

  await ensureHousehold(env.DB, HOUSEHOLD_ID);
  const profiles = await listProfiles(env.DB, HOUSEHOLD_ID);
  // With a single profile there's nothing to pick, so sign straight into it.
  const profileId = profiles.length === 1 ? profiles[0].id : null;
  const cookie = await sessionCookie(env, request, { householdId: HOUSEHOLD_ID, profileId });
  return Response.json({ profileId, profiles }, { headers: { "Set-Cookie": cookie } });
}
