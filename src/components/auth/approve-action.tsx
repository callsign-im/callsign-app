"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type HoldLink } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { HoldDetails } from "../dashboard/approvals";
import { Button, ButtonLink, ErrorNote, Spinner } from "../ui";

const DONE: Partial<Record<HoldLink["status"], { title: string; text: string }>> = {
  approved: { title: "Approved", text: "It goes out now, and the agent hears the outcome." },
  releasing: { title: "Approved", text: "It goes out now, and the agent hears the outcome." },
  released: { title: "Approved", text: "It went through, and the agent was told." },
  denied: { title: "Declined", text: "It didn't happen, and the agent was told." },
  expired: { title: "Expired", text: "Nobody decided in time, so it didn't happen." },
  failed: { title: "Approved, but it failed", text: "The agent was told why." },
};

export function ApproveAction() {
  const token = useSearchParams().get("token");
  const [hold, setHold] = useState<HoldLink | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This link is incomplete.");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ hold: HoldLink }>(`/v1/hold-links/${encodeURIComponent(token)}`).then(
      (found) => setHold(found.hold),
      (err: unknown) => setError(err instanceof Error ? err.message : "This link is not valid."),
    );
  }, [token]);

  async function decide(decision: "approve" | "deny") {
    if (!token || !hold) return;
    setBusy(decision);
    setError(null);
    try {
      const updated = await api<{ hold: HoldLink }>(`/v1/hold-links/${encodeURIComponent(token)}`, {
        method: "POST",
        body: { decision },
      });
      setHold({ ...updated.hold, needsPasskey: hold.needsPasskey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  if (error && !hold) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Link not valid</h1>
        <p className="mt-3 text-sm text-zinc-400">{error}</p>
        <ButtonLink href="/dashboard/approvals" className="mt-8">
          Open your approvals
        </ButtonLink>
      </div>
    );
  }

  if (!hold) {
    return (
      <p className="flex items-center gap-3 text-sm text-zinc-400">
        <Spinner /> Loading…
      </p>
    );
  }

  const done = DONE[hold.status];
  if (done) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{done.title}</h1>
        <p className="mt-3 text-sm text-zinc-400">{hold.summary}</p>
        <p className="mt-2 text-sm text-zinc-500">{done.text}</p>
        <ButtonLink href="/dashboard/approvals" variant="secondary" className="mt-8">
          Open your approvals
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="animate-fade-up grid gap-6">
      <div>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-300">{hold.agent}</span> · {timeAgo(hold.createdAt)}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">{hold.summary}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your rules hold it because {hold.why.join(" and ")}. It expires {timeAgo(hold.expiresAt)}{" "}
          if nobody decides.
        </p>
      </div>
      <div className="rounded-xl border border-white/10 px-4 py-3">
        <HoldDetails hold={hold} />
      </div>
      <div className="grid gap-2">
        {hold.needsPasskey ? (
          <ButtonLink href="/dashboard/approvals">Approve with your passkey</ButtonLink>
        ) : (
          <Button
            loading={busy === "approve"}
            disabled={busy !== null}
            onClick={() => void decide("approve")}
          >
            Approve
          </Button>
        )}
        <Button
          variant="secondary"
          loading={busy === "deny"}
          disabled={busy !== null}
          onClick={() => void decide("deny")}
        >
          Decline
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <p className="text-xs text-zinc-500">
        Don&apos;t forward the email: its link acts for you.
        {hold.needsPasskey && " You have a passkey, so approving happens in the dashboard."}
      </p>
    </div>
  );
}
