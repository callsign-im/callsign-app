"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type AlertLink } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Button, ButtonLink, ErrorNote, Spinner } from "../ui";

export function FreezeAlert() {
  const token = useSearchParams().get("token");
  const [alert, setAlert] = useState<AlertLink | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This link is incomplete.");
  const [busy, setBusy] = useState<"freeze" | "acknowledge" | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ alert: AlertLink }>(`/v1/freeze-links/${encodeURIComponent(token)}`).then(
      (found) => setAlert(found.alert),
      (err: unknown) => setError(err instanceof Error ? err.message : "This link is not valid."),
    );
  }, [token]);

  async function act(action: "freeze" | "acknowledge") {
    if (!token) return;
    setBusy(action);
    setError(null);
    try {
      const updated = await api<{ alert: AlertLink }>(
        `/v1/freeze-links/${encodeURIComponent(token)}`,
        { method: "POST", body: { action } },
      );
      setAlert(updated.alert);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  if (error && !alert) {
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

  if (!alert) {
    return (
      <p className="flex items-center gap-3 text-sm text-zinc-400">
        <Spinner /> Loading alert…
      </p>
    );
  }

  const name = alert.agent ?? "Your agent";

  if (alert.frozen) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{name} is frozen</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Every call it makes is refused and nothing wakes it. Messages to it keep arriving. When
          it&apos;s safe, unfreeze it from the dashboard, where you can also disconnect every app
          and token.
        </p>
        <ButtonLink href="/dashboard" variant="secondary" className="mt-8">
          Open the dashboard
        </ButtonLink>
      </div>
    );
  }

  if (alert.status === "acknowledged") {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Marked as you</h1>
        <p className="mt-3 text-sm text-zinc-400">
          {alert.kind === "new_network"
            ? `${name} won't alert you about this network again.`
            : "The alert is closed."}{" "}
          If you change your mind, you can still freeze it here.
        </p>
        <Button
          variant="danger"
          className="mt-8"
          loading={busy === "freeze"}
          onClick={() => void act("freeze")}
        >
          Freeze {name}
        </Button>
      </div>
    );
  }

  const { ip, network, userAgent, client } = alert.details;
  return (
    <div className="animate-fade-up grid gap-6">
      <div>
        <p className="text-xs text-zinc-500">Security alert · {timeAgo(alert.createdAt)}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">{alert.title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{alert.description}</p>
      </div>
      {(ip || client) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-white/10 px-4 py-3 text-sm">
          {client && (
            <>
              <dt className="text-zinc-500">Connection</dt>
              <dd className="truncate text-zinc-200">{client}</dd>
            </>
          )}
          {ip && (
            <>
              <dt className="text-zinc-500">Address</dt>
              <dd className="truncate font-mono text-zinc-200">{ip}</dd>
            </>
          )}
          {network && (
            <>
              <dt className="text-zinc-500">Network</dt>
              <dd className="truncate text-zinc-200">{network}</dd>
            </>
          )}
          {userAgent && (
            <>
              <dt className="text-zinc-500">App</dt>
              <dd className="truncate text-zinc-200">{userAgent}</dd>
            </>
          )}
        </dl>
      )}
      <div className="grid gap-2">
        <Button
          variant="danger"
          loading={busy === "freeze"}
          disabled={busy !== null}
          onClick={() => void act("freeze")}
        >
          Freeze {name}
        </Button>
        <Button
          variant="secondary"
          loading={busy === "acknowledge"}
          disabled={busy !== null}
          onClick={() => void act("acknowledge")}
        >
          It was me
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <p className="text-xs text-zinc-500">
        Freezing refuses every call the agent makes until you unfreeze it from the dashboard.
        Nothing is deleted. Don&apos;t forward the email: its link acts for you.
      </p>
    </div>
  );
}
