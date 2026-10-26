"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { api, type HeldAction } from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { Badge, Button, Card, ErrorNote, Spinner } from "../ui";
import { useApi, useLiveEvents } from "./hooks";

type HoldList = { holds: HeldAction[]; pending: number };

const STATUS: Record<
  HeldAction["status"],
  { label: string; tone: "neutral" | "success" | "danger" }
> = {
  pending: { label: "Waiting", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  releasing: { label: "Running", tone: "success" },
  released: { label: "Done", tone: "success" },
  denied: { label: "Declined", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

const HOLD_EVENTS = new Set(["action.held", "action.decided", "action.released", "action.expired"]);

function cancelled(err: unknown): boolean {
  return err instanceof Error && "code" in err && err.code === "step_up_cancelled";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function list(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(", ") : "";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 text-zinc-200">{children}</dd>
    </>
  );
}

/** Exactly what the agent asked for, so the owner approves the real thing. */
function Details({ hold }: { hold: HeldAction }) {
  const details = hold.details ?? {};
  const origin = hold.origin;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      {hold.kind === "message" && (
        <>
          <Row label="To">{text(details.to)}</Row>
          <Row label="Message">
            <span className="block max-h-48 overflow-auto whitespace-pre-wrap">
              {text(details.body)}
            </span>
          </Row>
          {Array.isArray(details.attachments) && details.attachments.length > 0 && (
            <Row label="Files">{details.attachments.length}</Row>
          )}
        </>
      )}
      {hold.kind === "group.create" && (
        <>
          <Row label="Group">#{text(details.name).replace(/^#/, "")}</Row>
          <Row label="Members">{list(details.members)}</Row>
        </>
      )}
      {hold.kind === "group.invite" && (
        <>
          <Row label="Group">#{text(details.group).replace(/^#/, "")}</Row>
          <Row label="Invites">{list(details.handles)}</Row>
        </>
      )}
      {hold.kind === "invite_person" && <Row label="Email">{text(details.email)}</Row>}
      {hold.kind === "tool.call" && (
        <>
          <Row label="Tool">{text(details.tool)}</Row>
          <Row label="Arguments">
            <pre className="max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap text-zinc-300">
              {JSON.stringify(details.arguments ?? {}, null, 2)}
            </pre>
          </Row>
        </>
      )}
      {typeof details.note === "string" && details.note && <Row label="Note">{details.note}</Row>}
      {origin && (
        <Row label="From">
          <span className="text-zinc-400">
            {origin.client}
            {origin.ip && (
              <>
                {" · "}
                <span className="font-mono">{origin.ip}</span>
              </>
            )}
            {origin.userAgent && ` · ${origin.userAgent}`}
          </span>
        </Row>
      )}
    </dl>
  );
}

function HoldCard({ hold, onDecided }: { hold: HeldAction; onDecided: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "deny") {
    setBusy(decision);
    setError(null);
    try {
      await api(`/v1/holds/${hold.id}`, { method: "POST", body: { decision } });
      await onDecided();
    } catch (err) {
      if (!cancelled(err)) setError(err instanceof Error ? err.message : "Couldn't decide it.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="grid gap-4 px-4 py-4 sm:px-5">
      <div>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-300">{hold.agent}</span> · {timeAgo(hold.createdAt)} · expires{" "}
          {timeAgo(hold.expiresAt)}
        </p>
        <p className="mt-1 text-sm text-white">{hold.summary}</p>
        <p className="mt-1 text-xs text-zinc-500">Held because {hold.why.join(" and ")}.</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <Details hold={hold} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={busy === "approve"}
          disabled={busy !== null}
          onClick={() => void decide("approve")}
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={busy === "deny"}
          disabled={busy !== null}
          onClick={() => void decide("deny")}
        >
          Decline
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </li>
  );
}

function ApproveAll({
  agent,
  ids,
  onDone,
}: {
  agent: string;
  ids: string[];
  onDone: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (ids.length < 2) return null;

  async function approveAll() {
    setBusy(true);
    setError(null);
    try {
      const outcome = await api<{ failed: { error: string }[] }>("/v1/holds/decide", {
        method: "POST",
        body: { ids, decision: "approve" },
      });
      if (outcome.failed.length > 0) setError(outcome.failed[0]?.error ?? null);
      await onDone();
    } catch (err) {
      if (!cancelled(err)) setError(err instanceof Error ? err.message : "Couldn't approve them.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-3">
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void approveAll()}>
        Approve all {ids.length} for {agent}
      </Button>
    </span>
  );
}

function useHolds(status: "pending" | "all") {
  const { mutate: mutateAll } = useSWRConfig();
  const path = status === "pending" ? "/v1/holds" : "/v1/holds?status=all";
  const query = useApi<HoldList>(path);
  useLiveEvents((event) => {
    if (HOLD_EVENTS.has(event.type)) void query.mutate();
  });
  const refresh = () => mutateAll((key) => typeof key === "string" && key.startsWith("/v1/holds"));
  return { ...query, refresh };
}

/** The badge count for the navigation. */
export function usePendingApprovals(): number {
  return useHolds("pending").data?.pending ?? 0;
}

/** A short list on the overview; the full one lives on the Approvals page. */
export function PendingApprovals() {
  const { data, refresh } = useHolds("pending");
  const holds = data?.holds ?? [];
  if (holds.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-white">
          Waiting for your approval <Badge tone="signal">{data?.pending}</Badge>
        </h2>
        <Link
          href="/dashboard/approvals"
          className="text-sm text-zinc-400 transition hover:text-white"
        >
          See all
        </Link>
      </div>
      <ul className="divide-y divide-white/5">
        {holds.slice(0, 3).map((hold) => (
          <HoldCard key={hold.id} hold={hold} onDecided={refresh} />
        ))}
      </ul>
    </Card>
  );
}

function History() {
  const { data } = useHolds("all");
  const decided = data?.holds.filter((hold) => hold.status !== "pending") ?? [];
  return (
    <Card>
      <h2 className="border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
        Decided
      </h2>
      {decided.length > 0 ? (
        <ul className="divide-y divide-white/5">
          {decided.map((hold) => (
            <li key={hold.id} className="flex items-start gap-4 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100">{hold.summary}</span>
                <span className="block text-xs text-zinc-500">
                  {hold.agent}
                  {hold.decidedVia && ` · decided by ${hold.decidedVia}`}
                  {typeof hold.result?.error === "string" && ` · ${hold.result.error}`}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
                <Badge tone={STATUS[hold.status].tone}>{STATUS[hold.status].label}</Badge>
                <span title={fullDate(hold.decidedAt ?? hold.createdAt)}>
                  {timeAgo(hold.decidedAt ?? hold.createdAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
          {data ? "Nothing decided yet." : "Loading…"}
        </p>
      )}
    </Card>
  );
}

export function ApprovalsPage() {
  const { data, refresh } = useHolds("pending");
  const byAgent = new Map<string, HeldAction[]>();
  for (const hold of data?.holds ?? []) {
    byAgent.set(hold.agent, [...(byAgent.get(hold.agent) ?? []), hold]);
  }

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Approvals</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Actions your agents tried that their rules hold until you decide. Approved ones go out in
          the order they were made; the agent hears the outcome either way. Set the rules on each
          agent&apos;s Security tab.
        </p>
      </div>

      {!data ? (
        <div className="flex justify-center p-10 text-zinc-500">
          <Spinner />
        </div>
      ) : byAgent.size === 0 ? (
        <Card className="p-6 text-sm text-zinc-400">Nothing is waiting for you.</Card>
      ) : (
        [...byAgent.entries()].map(([agent, holds]) => (
          <Card key={agent}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-medium text-white">{agent}</h2>
              <ApproveAll agent={agent} ids={holds.map((hold) => hold.id)} onDone={refresh} />
            </div>
            <ul className="divide-y divide-white/5">
              {holds.map((hold) => (
                <HoldCard key={hold.id} hold={hold} onDecided={refresh} />
              ))}
            </ul>
          </Card>
        ))
      )}

      <History />
    </div>
  );
}

export { Details as HoldDetails };
