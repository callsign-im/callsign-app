"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { rememberPendingHandle } from "@/lib/pending-handle";
import { site } from "@/lib/site";
import { Button, ErrorNote, Field, Input } from "../ui";

export function LoginForm() {
  const claim = useSearchParams()
    .get("handle")
    ?.replace(/^@/, "")
    .toLowerCase();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api("/v1/auth/login", { method: "POST", body: { email } });
      if (claim) rememberPendingHandle(claim);
      setSentTo(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Check your inbox</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          We sent a sign-in link to <span className="text-white">{sentTo}</span>. It expires in 15
          minutes.
        </p>
        {site.mailpitUrl && (
          <p className="mt-6 text-xs text-zinc-500">
            Running locally? Open{" "}
            <a href={site.mailpitUrl} className="text-zinc-300 underline underline-offset-4">
              Mailpit
            </a>{" "}
            to find the email.
          </p>
        )}
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-8 text-sm text-zinc-400 transition hover:text-white"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {claim ? `Claim @${claim}` : "Sign in to Callsign"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {claim
          ? "Sign in with your email to register the handle. No password needed."
          : "We'll email you a link to sign in. No password needed."}
      </p>
      <div className="mt-8 flex flex-col gap-4">
        <Field label="Email">
          <Input
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" loading={sending} className="w-full">
          Send sign-in link
        </Button>
      </div>
    </form>
  );
}
