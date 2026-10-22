"use client";

import { useState, type FormEvent } from "react";
import type { Profile } from "@/server/data";
import { linkDevice } from "@/lib/sync";

type Step = { kind: "passphrase" } | { kind: "name" } | { kind: "pick"; profiles: Profile[] };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json;
}

type AuthResult = { profileId: string | null; profiles: Profile[] };

export function SignIn() {
  const [step, setStep] = useState<Step>({ kind: "passphrase" });
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (result: AuthResult) => {
    const profile = result.profiles.find((p) => p.id === result.profileId);
    if (profile) await linkDevice({ profileId: profile.id, name: profile.name });
    else if (result.profiles.length === 0) {
      setValue("");
      setStep({ kind: "name" });
    } else setStep({ kind: "pick", profiles: result.profiles });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Can't reach Kanshou. Check the connection.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    run(async () => {
      if (step.kind === "passphrase") await finish(await post<AuthResult>("/api/login", { passphrase: value }));
      else await finish(await post<AuthResult>("/api/profile", { name: value }));
    });
  };

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-[max(2rem,env(safe-area-inset-top))]">
      <div className="animate-sheet-in w-full max-w-sm text-center">
        <p className="font-mincho text-7xl font-semibold text-paper">鑑賞</p>
        <p className="mt-2 text-sm uppercase tracking-[0.3em] text-paper-faint">Kanshou</p>

        {step.kind === "pick" ? (
          <div className="mt-10 space-y-3">
            <p className="text-paper-dim">Who&apos;s watching on this device?</p>
            {step.profiles.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => run(async () => finish(await post<AuthResult>("/api/profile", { id: p.id })))}
                className="h-16 w-full rounded-2xl bg-white/5 text-lg ring-1 ring-white/10 active:bg-white/15"
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-4">
            <p className="text-paper-dim">
              {step.kind === "passphrase" ? "Enter our household passphrase." : "What should we call you?"}
            </p>
            <input
              autoFocus
              type={step.kind === "passphrase" ? "password" : "text"}
              autoComplete={step.kind === "passphrase" ? "current-password" : "nickname"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={step.kind === "passphrase" ? "Passphrase" : "Your name"}
              className="h-16 w-full rounded-2xl bg-ink-raised px-5 text-center text-xl text-paper ring-1 ring-ink-line placeholder:text-paper-faint focus:outline-none focus:ring-2 focus:ring-shu/70"
            />
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="h-16 w-full rounded-2xl bg-shu text-lg font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "…" : step.kind === "passphrase" ? "Sign in" : "Continue"}
            </button>
          </form>
        )}
        {error && <p className="mt-4 text-sm text-shu">{error}</p>}
        <p className="mt-10 text-xs text-paper-faint">
          Shows you tracked on this device before signing in are kept and synced.
        </p>
      </div>
    </main>
  );
}
