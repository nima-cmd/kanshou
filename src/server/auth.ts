// Household sign-in. One shared passphrase (a Worker secret) gets a device a
// signed, year-long session cookie. Everything here is cheap on CPU so it fits
// the Workers free plan's per-request limit.

import { getCloudflareContext } from "@opennextjs/cloudflare";

export const HOUSEHOLD_ID = "home";
const COOKIE = "kanshou_session";
const SESSION_DAYS = 365;
const LOCKOUT_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

export type Session = { householdId: string; profileId: string | null };

export async function cfEnv(): Promise<CloudflareEnv> {
  return (await getCloudflareContext({ async: true })).env;
}

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Constant-time comparison of equal-length byte arrays. */
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function requireSecret(env: CloudflareEnv, name: "HOUSEHOLD_PASSPHRASE" | "SESSION_SECRET") {
  const value = env[name];
  if (!value || value.length < (name === "SESSION_SECRET" ? 32 : 8)) {
    throw new Error(`${name} is missing or too short. Set it in .dev.vars or with \`wrangler secret put ${name}\`.`);
  }
  return value;
}

/** Hashing both sides first makes the comparison length-independent. */
export async function passphraseMatches(env: CloudflareEnv, attempt: string) {
  const secret = requireSecret(env, "SESSION_SECRET");
  const expected = requireSecret(env, "HOUSEHOLD_PASSPHRASE");
  const [a, b] = await Promise.all([hmac(secret, attempt.trim()), hmac(secret, expected.trim())]);
  return sameBytes(a, b);
}

export function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
}

export async function isLockedOut(env: CloudflareEnv, ip: string) {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempt WHERE ip = ? AND at > ?")
    .bind(ip, since)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= LOCKOUT_ATTEMPTS;
}

export async function recordFailedLogin(env: CloudflareEnv, ip: string) {
  const old = new Date(Date.now() - 24 * 3600_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO login_attempt (ip, at) VALUES (?, ?)").bind(ip, new Date().toISOString()),
    env.DB.prepare("DELETE FROM login_attempt WHERE at < ?").bind(old),
  ]);
}

export async function sessionCookie(env: CloudflareEnv, request: Request, session: Session) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = b64url(enc.encode(JSON.stringify({ h: session.householdId, p: session.profileId, exp })));
  const sig = b64url(await hmac(requireSecret(env, "SESSION_SECRET"), payload));
  // Safari drops Secure cookies on plain http, which is how the iPad reaches the dev machine on Wi-Fi.
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secure}`;
}

export const clearedCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function readSession(env: CloudflareEnv, request: Request): Promise<Session | null> {
  const raw = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  try {
    const expected = await hmac(requireSecret(env, "SESSION_SECRET"), payload);
    if (!sameBytes(expected, fromB64url(sig))) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { h: string; p: string | null; exp: number };
    if (data.exp < Date.now()) return null;
    return { householdId: data.h, profileId: data.p };
  } catch {
    return null;
  }
}

export const unauthorized = () => Response.json({ error: "Not signed in" }, { status: 401 });
