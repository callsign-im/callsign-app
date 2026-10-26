"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fullDate } from "@/lib/format";
import { Button, ButtonLink, ErrorNote, Spinner } from "../ui";

type ResetLink = { status: "pending" | "cancelled" | "done"; runAt: string };

export function CancelPasskeyReset() {
  const token = useSearchParams().get("token");
  const [reset, setReset] = useState<ResetLink | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This link is incomplete.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<{ reset: ResetLink }>(`/v1/passkey-resets/${encodeURIComponent(token)}`).then(
      (found) => setReset(found.reset),
      (err: unknown) => setError(err instanceof Error ? err.message : "This link is not valid."),
    );
  }, [token]);

  async function cancel() {
    if (!token || !reset) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/passkey-resets/${encodeURIComponent(token)}/cancel`, { method: "POST" });
      setReset({ ...reset, status: "cancelled" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel it.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !reset) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Link not valid</h1>
        <p className="mt-3 text-sm text-zinc-400">{error}</p>
        <ButtonLink href="/dashboard" className="mt-8">
          Open the dashboard
        </ButtonLink>
      </div>
    );
  }

  if (!reset) {
    return (
      <p className="flex items-center gap-3 text-sm text-zinc-400">
        <Spinner /> Loading…
      </p>
    );
  }

  if (reset.status !== "pending") {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {reset.status === "cancelled" ? "Removal cancelled" : "Passkeys removed"}
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          {reset.status === "cancelled"
            ? "Your passkeys keep working. If you didn't ask for the removal, someone may have access to your email: secure it, then check your account page."
            : "Every passkey was removed from your account. You can add a new one from your account page."}
        </p>
        <ButtonLink href="/dashboard/account" variant="secondary" className="mt-8">
          Open your account
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="animate-fade-up grid gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Your passkeys will be removed
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Someone signed in to your Callsign account and asked to remove every passkey. It happens
          on {fullDate(reset.runAt)}. If it wasn&apos;t you, cancel it now.
        </p>
      </div>
      <Button loading={busy} onClick={() => void cancel()}>
        Cancel the removal
      </Button>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
