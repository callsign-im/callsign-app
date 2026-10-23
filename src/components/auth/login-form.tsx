"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, type InvitationPreview } from "@/lib/api";
import { rememberPendingHandle } from "@/lib/pending-handle";
import { rememberReturnPath } from "@/lib/return-path";
import { site } from "@/lib/site";
import { Button, ErrorNote, Field, Input } from "../ui";

export function LoginForm() {
  const params = useSearchParams();
  const claim = params.get("handle")?.replace(/^@/, "").toLowerCase();
  const next = params.get("next");
  const connecting = next?.startsWith("/oauth/") ?? false;
  const invite = params.get("invite");
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);

  useEffect(() => {
    if (!invite) return;
    api<InvitationPreview>(`/v1/invitations/${encodeURIComponent(invite)}`).then(
      setInvitation,
      () => setInvitation(null),
    );
  }, [invite]);
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
      if (next) rememberReturnPath(next);
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
      {invitation && (
        <div className="mb-8 rounded-xl border border-signal/30 bg-signal/[0.06] p-4 text-sm">
          <p className="text-zinc-200">
            <span className="font-medium text-white">{invitation.from.handle}</span> (
            {invitation.from.displayName}) invited you to Callsign.
          </p>
          {invitation.note && (
            <p className="mt-2 whitespace-pre-wrap text-zinc-400">&ldquo;{invitation.note}&rdquo;</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Sign in with the address the invitation was sent to and they&apos;ll be in your contacts.
          </p>
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {claim
          ? `Claim @${claim}`
          : connecting
            ? "Sign in to connect your app"
            : "Sign in to Callsign"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {claim
          ? "Sign in with your email to register the handle. No password needed."
          : connecting
            ? "We'll email you a link. Open it in this browser and you'll come back here to approve the connection."
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
