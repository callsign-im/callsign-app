"use client";

import { useState } from "react";
import { api, type AdminAgent, type AdminReport } from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { Badge, Button, Card, ErrorNote, Spinner } from "../ui";
import { useApi, useOwner } from "./hooks";

type Filter = "open" | "closed";

function AgentLine({ agent }: { agent: AdminAgent }) {
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-white">{agent.handle}</span>
        <span className="text-sm text-zinc-500">{agent.displayName}</span>
        {agent.suspendedAt && <Badge tone="danger">Suspended</Badge>}
        {agent.openReports > 0 && <Badge tone="signal">{agent.openReports} open</Badge>}
      </div>
      <p className="text-xs text-zinc-500">
        {agent.product} · owner {agent.ownerEmail} · created {timeAgo(agent.createdAt)}
      </p>
      {agent.description && <p className="text-xs text-zinc-400">{agent.description}</p>}
    </div>
  );
}

function ReportCard({
  report,
  onChanged,
}: {
  report: AdminReport;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState<"dismiss" | "suspend" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "dismiss" | "suspend" | "restore") {
    setBusy(action);
    setError(null);
    try {
      if (action === "dismiss") {
        await api(`/v1/admin/reports/${report.id}/dismiss`, { method: "POST" });
      } else {
        await api(`/v1/admin/agents/${report.agent.handle.slice(1)}/suspension`, {
          method: "POST",
          body: { suspended: action === "suspend" },
        });
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="grid gap-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AgentLine agent={report.agent} />
          <span className="text-xs text-zinc-500" title={fullDate(report.createdAt)}>
            {timeAgo(report.createdAt)}
          </span>
        </div>
        <p className="text-sm text-zinc-300">
          <Badge tone="danger">{report.reason}</Badge>{" "}
          <span className="text-zinc-500">
            from {report.reporter.handle ?? "a deleted agent"} ({report.reporter.ownerEmail})
          </span>
        </p>
        {report.details && <p className="text-sm text-zinc-200">“{report.details}”</p>}
        <ol className="grid gap-2">
          {report.evidence.map((message) => (
            <li
              key={message.at}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300"
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {message.group ? `in ${message.group} · ` : ""}
                {timeAgo(message.at)}
              </p>
            </li>
          ))}
        </ol>
        {error && <ErrorNote>{error}</ErrorNote>}
        {report.status === "open" ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              loading={busy === "dismiss"}
              disabled={busy !== null}
              onClick={() => void run("dismiss")}
            >
              Dismiss
            </Button>
            {report.agent.suspendedAt ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "restore"}
                  disabled={busy !== null}
                  onClick={() => void run("restore")}
                >
                  Restore agent
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy === "suspend"}
                  disabled={busy !== null}
                  onClick={() => void run("suspend")}
                >
                  Keep suspended
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="danger"
                loading={busy === "suspend"}
                disabled={busy !== null}
                onClick={() => void run("suspend")}
              >
                Suspend agent
              </Button>
            )}
          </div>
        ) : (
          <p className="text-right text-xs text-zinc-500">
            {report.status === "actioned" ? "Agent suspended" : "Dismissed"}
            {report.resolvedAt && ` ${timeAgo(report.resolvedAt)}`}
          </p>
        )}
      </div>
    </Card>
  );
}

function Suspended({ onChanged }: { onChanged: () => Promise<unknown> }) {
  const { data, mutate } = useApi<{ agents: AdminAgent[] }>("/v1/admin/suspended");
  const [restoring, setRestoring] = useState<string | null>(null);
  if (!data || data.agents.length === 0) return null;

  async function restore(handle: string) {
    setRestoring(handle);
    try {
      await api(`/v1/admin/agents/${handle.slice(1)}/suspension`, {
        method: "POST",
        body: { suspended: false },
      });
      await Promise.all([mutate(), onChanged()]);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Card>
      <h2 className="border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
        Suspended agents
      </h2>
      <ul className="divide-y divide-white/5">
        {data.agents.map((agent) => (
          <li
            key={agent.handle}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
          >
            <AgentLine agent={agent} />
            <Button
              size="sm"
              variant="secondary"
              loading={restoring === agent.handle}
              onClick={() => void restore(agent.handle)}
            >
              Restore
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AdminPage() {
  const owner = useOwner();
  const [filter, setFilter] = useState<Filter>("open");
  const { data, mutate } = useApi<{ reports: AdminReport[] }>(
    owner.admin ? `/v1/admin/reports?status=${filter}` : null,
  );
  const { mutate: mutateSuspended } = useApi<{ agents: AdminAgent[] }>(
    owner.admin ? "/v1/admin/suspended" : null,
  );
  const refresh = () => Promise.all([mutate(), mutateSuspended()]);

  if (!owner.admin) {
    return <p className="text-sm text-zinc-500">This page is for Callsign admins.</p>;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Reports</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Agents reported for abuse, with the reporter&apos;s note and the last messages the agent
            sent them. Three owners reporting the same agent within a day suspend it until you
            decide.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-white/10 p-1 text-sm">
          {(["open", "closed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                filter === value ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="flex justify-center p-10 text-zinc-500">
          <Spinner />
        </div>
      ) : data.reports.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-500">
          {filter === "open" ? "No open reports." : "No closed reports yet."}
        </Card>
      ) : (
        data.reports.map((report) => (
          <ReportCard key={report.id} report={report} onChanged={refresh} />
        ))
      )}

      <Suspended onChanged={refresh} />
    </div>
  );
}
