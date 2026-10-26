"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import {
  agentPath,
  api,
  type AgentNetwork,
  type OwnedAgent,
  type SecurityAlert,
  type Sighting,
} from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { Badge, Button, Card, ErrorNote } from "../ui";
import { useApi, useLiveEvents } from "./hooks";
import { RulesCard } from "./rules-card";

const ALERT_STATUS: Record<SecurityAlert["status"], { label: string; tone: "neutral" | "danger" }> =
  {
    open: { label: "Open", tone: "danger" },
    acknowledged: { label: "It was you", tone: "neutral" },
    frozen: { label: "Frozen", tone: "danger" },
    resolved: { label: "Resolved", tone: "neutral" },
  };

function errorText(err: unknown, fallback: string): string | null {
  if (err instanceof Error && "code" in err && err.code === "step_up_cancelled") return null;
  return err instanceof Error ? err.message : fallback;
}

/** Revalidates everything that shows whether an agent is frozen. */
function useRefreshAgent() {
  const { mutate } = useSWRConfig();
  return (handle: string) =>
    Promise.all([
      mutate(agentPath(handle)),
      mutate("/v1/agents"),
      mutate((key) => typeof key === "string" && key.startsWith("/v1/alerts")),
    ]);
}

export function SightingLine({ sighting }: { sighting: Sighting }) {
  return (
    <span className="block truncate text-xs text-zinc-500">
      <span className="font-mono text-zinc-400">{sighting.ip}</span>
      {sighting.network && ` · ${sighting.network}`}
      {sighting.userAgent && ` · ${sighting.userAgent}`}
    </span>
  );
}

function AlertRow({ alert, onChange }: { alert: SecurityAlert; onChange: () => Promise<unknown> }) {
  const refresh = useRefreshAgent();
  const [busy, setBusy] = useState<"freeze" | "ack" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handle = alert.agent;

  async function act(kind: "freeze" | "ack") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "freeze" && handle) {
        await api(agentPath(handle, "/freeze"), { method: "POST", body: { alertId: alert.id } });
        await refresh(handle);
      } else {
        await api(`/v1/alerts/${alert.id}/ack`, { method: "POST" });
      }
      await onChange();
    } catch (err) {
      setError(errorText(err, "Couldn't update the alert."));
    } finally {
      setBusy(null);
    }
  }

  const { ip, network, userAgent } = alert.details;
  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-white">
          {alert.title}
          <span className="text-xs text-zinc-500" title={fullDate(alert.createdAt)}>
            {timeAgo(alert.createdAt)}
          </span>
        </p>
        <p className="mt-1 text-sm text-zinc-400">{alert.description}</p>
        {ip && (
          <p className="mt-1 text-xs text-zinc-500">
            <span className="font-mono text-zinc-400">{ip}</span>
            {network && ` · ${network}`}
            {userAgent && ` · ${userAgent}`}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {handle && (
          <Button
            variant="danger"
            size="sm"
            loading={busy === "freeze"}
            disabled={busy !== null}
            onClick={() => void act("freeze")}
          >
            Freeze {handle}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          loading={busy === "ack"}
          disabled={busy !== null}
          onClick={() => void act("ack")}
        >
          It was me
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </li>
  );
}

/** Open alerts, across every agent or for one. Renders nothing when there are none. */
export function SecurityAlerts({ handle }: { handle?: string }) {
  const { data, mutate } = useApi<{ alerts: SecurityAlert[] }>("/v1/alerts");
  useLiveEvents((event) => {
    if (event.type === "security.alert" || event.type === "agent.frozen") void mutate();
  });
  const alerts = data?.alerts.filter((alert) => !handle || alert.agent === handle) ?? [];
  if (alerts.length === 0) return null;

  return (
    <Card className="border-red-400/25">
      <h2 className="flex items-center gap-2 border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
        Security alerts <Badge tone="danger">{alerts.length}</Badge>
      </h2>
      <ul className="divide-y divide-white/5">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onChange={() => mutate()} />
        ))}
      </ul>
    </Card>
  );
}

/** The Freeze button in an agent's header. */
export function FreezeButton({ agent }: { agent: OwnedAgent }) {
  const refresh = useRefreshAgent();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (agent.frozenAt) return null;

  async function freeze() {
    setBusy(true);
    setError(null);
    try {
      await api(agentPath(agent.handle, "/freeze"), { method: "POST", body: {} });
      await refresh(agent.handle);
      setConfirming(false);
    } catch (err) {
      setError(errorText(err, "Couldn't freeze it."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {confirming ? (
        <span className="flex gap-2">
          <Button variant="danger" size="sm" loading={busy} onClick={() => void freeze()}>
            Freeze {agent.handle}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep running
          </Button>
        </span>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          Freeze
        </Button>
      )}
      {confirming && (
        <p className="max-w-xs text-right text-xs text-zinc-500">
          Every call it makes is refused until you unfreeze it. Messages to it keep arriving.
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

/** Shown under the header while an agent is frozen. */
export function FrozenNotice({ agent }: { agent: OwnedAgent }) {
  const refresh = useRefreshAgent();
  const [revokeTokens, setRevokeTokens] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!agent.frozenAt) return null;

  async function unfreeze() {
    setBusy(true);
    setError(null);
    try {
      await api(agentPath(agent.handle, "/unfreeze"), { method: "POST", body: { revokeTokens } });
      await refresh(agent.handle);
    } catch (err) {
      setError(errorText(err, "Couldn't unfreeze it."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 grid gap-3 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3">
      <p className="text-sm text-zinc-200">
        {agent.handle} has been frozen since {timeAgo(agent.frozenAt)}. Every call it makes is
        refused and nothing wakes it. Messages to it keep arriving in its inbox.
      </p>
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={revokeTokens}
          onChange={(e) => setRevokeTokens(e.target.checked)}
          className="mt-0.5 accent-signal"
        />
        <span>
          Also disconnect every app and token, if one may have leaked. Each app connects again with
          your approval.
        </span>
      </label>
      <div>
        <Button size="sm" loading={busy} onClick={() => void unfreeze()}>
          Unfreeze {agent.handle}
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

function AlertHistory({ handle }: { handle: string }) {
  const { data } = useApi<{ alerts: SecurityAlert[] }>("/v1/alerts?status=all");
  const alerts = data?.alerts.filter((alert) => alert.agent === handle) ?? [];
  return (
    <Card>
      <h2 className="border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
        Alerts
      </h2>
      {alerts.length > 0 ? (
        <ul className="divide-y divide-white/5">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-start gap-4 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-zinc-100">{alert.title}</span>
                <span className="block text-xs text-zinc-500">{alert.description}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
                <Badge tone={ALERT_STATUS[alert.status].tone}>
                  {ALERT_STATUS[alert.status].label}
                </Badge>
                {timeAgo(alert.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
          {data ? "No alerts so far." : "Loading…"}
        </p>
      )}
    </Card>
  );
}

function Networks({ handle }: { handle: string }) {
  const { data } = useApi<{ networks: AgentNetwork[] }>(agentPath(handle, "/networks"));
  return (
    <Card>
      <div className="border-b border-white/5 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-medium text-white">Networks</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Where its tokens were used from. The first one is its baseline; a new one sends you an
          alert.
        </p>
      </div>
      {data?.networks.length ? (
        <ul className="divide-y divide-white/5">
          {data.networks.map((network) => (
            <li key={network.label} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-200">
                {network.label}
              </span>
              <span className="text-xs text-zinc-500">since {timeAgo(network.firstSeenAt)}</span>
              <Badge tone={network.status === "known" ? "neutral" : "danger"}>
                {network.status === "known" ? "Known" : "Unconfirmed"}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
          {data ? "It hasn't connected since Callsign started recording networks." : "Loading…"}
        </p>
      )}
    </Card>
  );
}

function DisconnectEverything({ agent }: { agent: OwnedAgent }) {
  const { mutate } = useSWRConfig();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      const { revoked } = await api<{ revoked: number }>(
        agentPath(agent.handle, "/tokens/revoke-all"),
        { method: "POST" },
      );
      setDone(revoked);
      setConfirming(false);
      await mutate(agentPath(agent.handle, "/tokens"));
    } catch (err) {
      setError(errorText(err, "Couldn't disconnect them."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-4 p-5 sm:p-6">
      <div className="max-w-xl">
        <h2 className="font-medium text-white">Disconnect everything</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Revokes every token and signs out every app connected as {agent.handle}. Use it when a
          token may have leaked; each app connects again with your approval.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <Button variant="danger" loading={busy} onClick={() => void revoke()}>
              Disconnect all
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Disconnect everything
          </Button>
        )}
        {done !== null && (
          <span className="text-sm text-zinc-400">
            Disconnected {done} {done === 1 ? "connection" : "connections"}.
          </span>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}

export function SecurityPanel({ agent }: { agent: OwnedAgent }) {
  return (
    <div className="grid gap-6">
      <RulesCard agent={agent} />
      <Card className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-xl">
          <h2 className="font-medium text-white">Freeze</h2>
          <p className="mt-1 text-sm text-zinc-500">
            If something looks wrong, freeze {agent.handle}: every call it makes is refused, open
            waits end and nothing wakes it, until you unfreeze it. Nothing is deleted. You can also
            freeze it from an alert email or Telegram.
          </p>
        </div>
        {agent.frozenAt ? <Badge tone="danger">Frozen</Badge> : <FreezeButton agent={agent} />}
      </Card>
      <Networks handle={agent.handle} />
      <AlertHistory handle={agent.handle} />
      <DisconnectEverything agent={agent} />
    </div>
  );
}
