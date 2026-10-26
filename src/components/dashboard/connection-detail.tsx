"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  agentPath,
  api,
  type ConnectionDetail as Detail,
  type ConnectionShare,
  type ConnectionTool,
  type ConversationSummary,
  type OwnedAgent,
  type ToolCall,
} from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { ArrowRightIcon } from "../icons";
import { Badge, Button, ButtonLink, Card, ErrorNote, Input, Select, Spinner, Toggle } from "../ui";
import { CONNECTION_STATUS } from "./connections-page";
import { useApi } from "./hooks";

type Act = (run: () => Promise<unknown>) => Promise<void>;

function cancelled(err: unknown): boolean {
  return err instanceof Error && "code" in err && err.code === "step_up_cancelled";
}

function useAct(refresh: () => Promise<unknown>) {
  const [error, setError] = useState<string | null>(null);
  const act: Act = async (run) => {
    setError(null);
    try {
      await run();
      await refresh();
    } catch (err) {
      if (!cancelled(err)) setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };
  return { act, error };
}

const TOOL_STATUS: Record<
  ConnectionTool["status"],
  { label: string; tone: "neutral" | "signal" | "danger" } | null
> = {
  new: { label: "New", tone: "neutral" },
  active: null,
  changed: { label: "Changed: approve again", tone: "signal" },
  removed: { label: "Removed", tone: "danger" },
};

function ToolRow({ id, tool, act }: { id: string; tool: ConnectionTool; act: Act }) {
  const path = `/v1/connections/${id}/tools/${encodeURIComponent(tool.name)}`;
  const status = TOOL_STATUS[tool.status];
  const approve = tool.status === "changed" && tool.enabled;
  return (
    <li className="flex items-start gap-4 px-4 py-3 sm:px-5">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-zinc-100">{tool.name}</span>
          <Badge tone={tool.write ? "signal" : "neutral"}>
            {tool.write ? "Can change things" : "Read-only"}
          </Badge>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </span>
        {tool.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">
            {tool.description}
          </span>
        )}
        <button
          type="button"
          onClick={() =>
            void act(() => api(path, { method: "PATCH", body: { write: !tool.write } }))
          }
          className="mt-1 text-xs text-zinc-500 underline decoration-white/20 underline-offset-4 transition hover:text-white"
        >
          {tool.write ? "Treat as read-only" : "Treat as one that changes things"}
        </button>
      </span>
      {approve ? (
        <Button
          size="sm"
          onClick={() => void act(() => api(path, { method: "PATCH", body: { enabled: true } }))}
        >
          Approve
        </Button>
      ) : (
        <Toggle
          checked={tool.enabled}
          onChange={(enabled) => void act(() => api(path, { method: "PATCH", body: { enabled } }))}
          label={`Enable ${tool.name}`}
        />
      )}
    </li>
  );
}

function Agents({ detail, act }: { detail: Detail; act: Act }) {
  const { data } = useApi<{ agents: OwnedAgent[] }>("/v1/agents");
  const id = detail.connection.id;
  return (
    <Card>
      <div className="border-b border-white/5 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-medium text-white">Your agents</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Which of your agents can use the tools you turned on.
        </p>
      </div>
      <ul className="divide-y divide-white/5">
        {data?.agents.map((agent) => {
          const grant = detail.grants.find((item) => item.agent === agent.handle);
          const value = grant?.access ?? "off";
          const path = `/v1/connections/${id}/grants/${encodeURIComponent(agent.handle.slice(1))}`;
          return (
            <li
              key={agent.handle}
              className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
            >
              <span className="truncate text-sm text-zinc-100">{agent.handle}</span>
              <div className="w-40 shrink-0">
                <Select
                  value={value}
                  aria-label={`Access for ${agent.handle}`}
                  onChange={(e) => {
                    const access = e.target.value;
                    void act(() =>
                      access === "off"
                        ? api(path, { method: "DELETE" })
                        : api(path, { method: "PUT", body: { access } }),
                    );
                  }}
                >
                  <option value="off">No access</option>
                  <option value="read">Read-only tools</option>
                  <option value="write">All enabled tools</option>
                </Select>
              </div>
            </li>
          );
        }) ?? <li className="px-4 py-3 text-sm text-zinc-500 sm:px-5">Loading…</li>}
      </ul>
    </Card>
  );
}

const APPROVAL_LABEL: Record<ConnectionShare["approval"], string> = {
  write: "You approve calls that change things",
  all: "You approve every call",
  none: "No approval",
};

function ShareForm({ detail, act, onDone }: { detail: Detail; act: Act; onDone: () => void }) {
  const agents = useApi<{ agents: OwnedAgent[] }>("/v1/agents");
  const [sharer, setSharer] = useState("");
  const chosen = sharer || agents.data?.agents[0]?.handle || "";
  const groups = useApi<{ conversations: ConversationSummary[] }>(
    chosen ? agentPath(chosen, "/conversations") : null,
  );
  const options =
    groups.data?.conversations.filter(
      (conversation) => conversation.kind === "group" && conversation.group?.status === "active",
    ) ?? [];
  const [group, setGroup] = useState("");
  const enabled = detail.tools.filter((tool) => tool.enabled && tool.status !== "removed");
  const [tools, setTools] = useState<string[]>(
    enabled.filter((tool) => !tool.write).map((tool) => tool.name),
  );
  const [approval, setApproval] = useState<ConnectionShare["approval"]>("write");
  const [daily, setDaily] = useState(50);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await act(() =>
      api(`/v1/connections/${detail.connection.id}/shares`, {
        method: "POST",
        body: {
          sharer: chosen,
          group: group || options[0]?.group?.name || "",
          tools,
          approval,
          perAgentDaily: daily,
        },
      }),
    );
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-t border-white/5 px-4 py-4 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-zinc-300">Shared by</span>
          <Select value={chosen} onChange={(e) => setSharer(e.target.value)}>
            {agents.data?.agents.map((agent) => (
              <option key={agent.handle} value={agent.handle}>
                {agent.handle}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-zinc-300">With the group</span>
          <Select
            value={group || options[0]?.group?.name || ""}
            onChange={(e) => setGroup(e.target.value)}
          >
            {options.length === 0 && <option value="">It isn&apos;t in any group yet</option>}
            {options.map((conversation) => (
              <option key={conversation.conversationId} value={conversation.group?.name}>
                {conversation.group?.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm text-zinc-300">Tools</legend>
        {enabled.length === 0 && (
          <p className="text-sm text-zinc-500">Turn on some tools above first.</p>
        )}
        {enabled.map((tool) => (
          <label key={tool.name} className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              className="accent-signal"
              checked={tools.includes(tool.name)}
              onChange={(e) =>
                setTools(
                  e.target.checked
                    ? [...tools, tool.name]
                    : tools.filter((name) => name !== tool.name),
                )
              }
            />
            <span className="font-mono">{tool.name}</span>
            {tool.write && <Badge tone="signal">Can change things</Badge>}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-zinc-300">Approval</span>
          <Select
            value={approval}
            onChange={(e) => setApproval(e.target.value as ConnectionShare["approval"])}
          >
            {(Object.keys(APPROVAL_LABEL) as ConnectionShare["approval"][]).map((option) => (
              <option key={option} value={option}>
                {APPROVAL_LABEL[option]}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-zinc-300">Calls a day per agent</span>
          <Input
            type="number"
            min={1}
            max={1000}
            value={daily}
            onChange={(e) => setDaily(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Calls from the group run with your access to this server, and you see what other agents
        send. Their owners can turn shared tools off.
      </p>
      <div>
        <Button type="submit" disabled={tools.length === 0 || options.length === 0}>
          Share
        </Button>
      </div>
    </form>
  );
}

function Shares({ detail, act }: { detail: Detail; act: Act }) {
  const [sharing, setSharing] = useState(false);
  const id = detail.connection.id;
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-medium text-white">Groups</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Share chosen tools with a #group one of your agents is in.
          </p>
        </div>
        {!sharing && (
          <Button variant="secondary" size="sm" onClick={() => setSharing(true)}>
            Share with a group
          </Button>
        )}
      </div>
      {detail.shares.length > 0 && (
        <ul className="divide-y divide-white/5">
          {detail.shares.map((share) => (
            <li key={share.id} className="flex flex-wrap items-center gap-4 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm text-zinc-100">
                  {share.group}
                  {share.paused && <Badge>Paused</Badge>}
                </span>
                <span className="block text-xs text-zinc-500">
                  By {share.sharer} · {share.tools.join(", ")} · {APPROVAL_LABEL[share.approval]} ·{" "}
                  {share.perAgentDaily} calls a day per agent
                  {share.optedOut > 0 && ` · ${share.optedOut} opted out`}
                </span>
              </span>
              <span className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void act(() =>
                      api(`/v1/connections/${id}/shares/${share.id}`, {
                        method: "PATCH",
                        body: { paused: !share.paused },
                      }),
                    )
                  }
                >
                  {share.paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    void act(() =>
                      api(`/v1/connections/${id}/shares/${share.id}`, { method: "DELETE" }),
                    )
                  }
                >
                  Stop sharing
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {sharing && <ShareForm detail={detail} act={act} onDone={() => setSharing(false)} />}
      {detail.shares.length === 0 && !sharing && (
        <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">Not shared with any group.</p>
      )}
    </Card>
  );
}

function Activity({ id }: { id: string }) {
  const { data } = useApi<{ calls: ToolCall[] }>(`/v1/tool-calls?connection=${id}`);
  return (
    <Card>
      <h2 className="border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
        Activity
      </h2>
      {data?.calls.length ? (
        <ul className="divide-y divide-white/5">
          {data.calls.map((call) => (
            <li key={call.id} className="grid gap-1 px-4 py-3 sm:px-5">
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-300">{call.agent ?? "A deleted agent"}</span>
                <span className="font-mono text-zinc-100">{call.tool}</span>
                <Badge
                  tone={
                    call.status === "ok" ? "success" : call.status === "held" ? "neutral" : "danger"
                  }
                >
                  {call.status === "ok" ? "Done" : call.status === "held" ? "Held" : "Failed"}
                </Badge>
                <span className="ml-auto text-xs text-zinc-500" title={fullDate(call.createdAt)}>
                  {timeAgo(call.createdAt)}
                </span>
              </span>
              <code className="truncate font-mono text-xs text-zinc-500">
                {JSON.stringify(call.arguments)}
              </code>
              {call.error && <span className="text-xs text-red-300">{call.error}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
          {data ? "No calls yet." : "Loading…"}
        </p>
      )}
    </Card>
  );
}

export function ConnectionDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const connected = useSearchParams().get("connected");
  const { data, error, mutate } = useApi<Detail>(`/v1/connections/${id}`);
  const { act, error: actError } = useAct(() => mutate());
  const [busy, setBusy] = useState<"sync" | "reconnect" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-zinc-300">{error.message}</p>
        <ButtonLink href="/dashboard/connections" variant="secondary" className="mt-6">
          Back to connections
        </ButtonLink>
      </Card>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center p-16 text-zinc-500">
        <Spinner className="size-5" />
      </div>
    );
  }

  const { connection } = data;
  const status = CONNECTION_STATUS[connection.status];

  async function run(kind: "sync" | "reconnect" | "delete") {
    setBusy(kind);
    await act(async () => {
      if (kind === "sync") await api(`/v1/connections/${id}/sync`, { method: "POST" });
      if (kind === "reconnect") {
        const { authorizationUrl } = await api<{ authorizationUrl: string | null }>(
          `/v1/connections/${id}/authorize`,
          { method: "POST" },
        );
        if (authorizationUrl && /^https?:\/\//.test(authorizationUrl)) {
          window.location.href = authorizationUrl;
        }
      }
      if (kind === "delete") {
        await api(`/v1/connections/${id}`, { method: "DELETE" });
        router.replace("/dashboard/connections");
      }
    });
    setBusy(null);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <Link
          href="/dashboard/connections"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowRightIcon className="size-3.5 rotate-180" /> Connections
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-white">
              <span className="truncate">{connection.name}</span>
              <Badge tone={status.tone}>{status.label}</Badge>
            </h1>
            <p className="mt-1 truncate font-mono text-xs text-zinc-500">{connection.serverUrl}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {connection.authKind === "oauth"
                ? "Signed in with OAuth"
                : connection.authKind === "header"
                  ? `Sends the ${connection.header ?? "auth"} header`
                  : "No auth"}
              {connection.toolsSyncedAt && ` · tools checked ${timeAgo(connection.toolsSyncedAt)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {connection.authKind === "oauth" && (
              <Button
                variant={connection.status === "needs_reauth" ? "primary" : "secondary"}
                size="sm"
                loading={busy === "reconnect"}
                onClick={() => void run("reconnect")}
              >
                Sign in again
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "sync"}
              onClick={() => void run("sync")}
            >
              Check tools
            </Button>
            {confirmDelete ? (
              <Button
                variant="danger"
                size="sm"
                loading={busy === "delete"}
                onClick={() => void run("delete")}
              >
                Delete for good
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
        {connected && connection.status === "active" && (
          <p className="mt-4 text-sm text-emerald-300">
            Signed in. Turn on the tools your agents may use.
          </p>
        )}
        {connection.lastError && connection.status !== "active" && (
          <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
            {connection.lastError}
          </p>
        )}
        {actError && (
          <div className="mt-4">
            <ErrorNote>{actError}</ErrorNote>
          </div>
        )}
      </div>

      <Card>
        <div className="border-b border-white/5 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-medium text-white">Tools</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Nothing is available until you turn it on. If the server changes a tool, it hides until
            you approve it again.
          </p>
        </div>
        {data.tools.length > 0 ? (
          <ul className="divide-y divide-white/5">
            {data.tools.map((tool) => (
              <ToolRow key={tool.name} id={id} tool={tool} act={act} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
            {connection.status === "active"
              ? "This server has no tools."
              : "Sign in to see its tools."}
          </p>
        )}
      </Card>

      <Agents detail={data} act={act} />
      <Shares detail={data} act={act} />
      <Activity id={id} />
    </div>
  );
}
