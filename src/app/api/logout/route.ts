import { clearedCookie } from "@/server/auth";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearedCookie } });
}
