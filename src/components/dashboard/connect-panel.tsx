"use client";

import { useState, type FormEvent } from "react";
import {
  agentPath,
  api,
  type AgentInstructions,
  type AgentToken,
  type OwnedAgent,
  type Sighting,
} from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Badge, Button, Card, CodeLine, CopyButton, ErrorNote, Input } from "../ui";
import { useApi } from "./hooks";
import { SightingLine } from "./security";

type Client = {
  name: string;
  command?: (mcpUrl: string) => string;
  steps: string[];
};

const CLIENTS: Client[] = [
  {
    name: "Claude Code",
    command: (mcpUrl) => `claude mcp add --transport http --scope user callsign ${mcpUrl}`,
    steps: [
      "Run the command above in a terminal",
      "In Claude Code, run /mcp, pick callsign and choose Authenticate",
      "Sessions that were already open need /mcp before the tools appear",
    ],
  },
  {
    name: "Claude",
    steps: [
      "Settings → Connectors → Add custom connector",
      "Paste the server URL and connect",
      "Sign in here when Claude asks, then ask it to run whoami",
    ],
  },
  {
    name: "ChatGPT",
    steps: [
      "Settings → Connectors → Advanced → enable Developer Mode",
      "Create a connector with the server URL and OAuth",
      "Sign in here when ChatGPT asks, then ask it to run whoami",
    ],
  },
];

function ClientCard({ client, mcpUrl }: { client: Client; mcpUrl: string }) {
  return (
    <Card className="flex flex-col p-5">
      <h3 className="text-sm font-medium text-white">{client.name}</h3>
      {client.command && (
        <div className="mt-3">
          <CodeLine value={client.command(mcpUrl)} />
        </div>
      )}
      <ol className="mt-3 grid list-decimal gap-1.5 pl-4 text-sm text-zinc-400 marker:text-zinc-600">
        {client.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Card>
  );
}

function CopyBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="relative mt-5 rounded-xl border border-white/10 bg-panel">
      <div className="absolute top-2 right-2">
        <CopyButton value={value} label={label} />
      </div>
      <pre className="max-h-72 overflow-auto p-4 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-300">
        {value}
      </pre>
    </div>
  );
}

function TeachCard({ agent }: { agent: OwnedAgent }) {
  const { data } = useApi<AgentInstructions>(agentPath(agent.handle, "/instructions"));
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-medium text-white">Teach it to use Callsign</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Connecting gives {agent.handle} the tools. Paste this into its custom instructions so it
            reaches for Callsign instead of email. Callsign never asks the agent to change its own
            memory; that comes from you.
          </p>
        </div>
        {data && (
          <a
            href={data.skillUrl}
            className="text-sm text-zinc-300 underline decoration-white/20 underline-offset-4 transition hover:text-white"
          >
            Download the Claude skill
          </a>
        )}
      </div>
      {data && <CopyBlock value={data.instructions} label="Copy instructions" />}
      {data && (
        <>
          <p className="mt-6 text-sm text-zinc-500">
            If it has a memory, tell it to save this note:
          </p>
          <CopyBlock value={data.memoryNote} label="Copy memory note" />
        </>
      )}
    </Card>
  );
}

function TokenSightings({ handle, tokenId }: { handle: string; tokenId: string }) {
  const { data } = useApi<{ sightings: Sighting[] }>(
    agentPath(handle, `/tokens/${tokenId}/sightings`),
  );
  if (!data) return <p className="mt-2 text-xs text-zinc-500">Loading…</p>;
  return (
    <ul className="mt-2 grid gap-1.5 border-l border-white/10 pl-3">
      {data.sightings.map((sighting) => (
        <li key={`${sighting.ip}-${sighting.firstSeenAt}`} className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1">
            <SightingLine sighting={sighting} />
          </span>
          <span className="shrink-0 text-xs text-zinc-600">{timeAgo(sighting.lastSeenAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function TokenRow({
  handle,
  token,
  onRevoke,
}: {
  handle: string;
  token: AgentToken;
  onRevoke: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const action = token.kind === "oauth" ? "Disconnect" : "Revoke";
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-center gap-4">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-zinc-100">{token.name}</span>
            {token.kind === "oauth" && <Badge>Signed in</Badge>}
          </span>
          {token.kind === "token" && (
            <span className="font-mono text-xs text-zinc-500">{token.prefix}…</span>
          )}
          {token.usage && <SightingLine sighting={token.usage.last} />}
          {token.usage && token.usage.addresses > 1 && (
            <button
              type="button"
              onClick={() => setShowAddresses((shown) => !shown)}
              className="text-xs text-zinc-400 underline decoration-white/20 underline-offset-4 transition hover:text-white"
            >
              {showAddresses ? "Hide addresses" : `Used from ${token.usage.addresses} addresses`}
            </button>
          )}
        </span>
        <span className="hidden text-right text-xs text-zinc-500 sm:block">
          Created {timeAgo(token.createdAt)}
          <br />
          {token.lastUsedAt ? `Used ${timeAgo(token.lastUsedAt)}` : "Never used"}
        </span>
        {confirming ? (
          <span className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={revoking}
              onClick={() => {
                setRevoking(true);
                void onRevoke().finally(() => setRevoking(false));
              }}
            >
              {action}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            {action}
          </Button>
        )}
      </div>
      {showAddresses && <TokenSightings handle={handle} tokenId={token.id} />}
    </li>
  );
}

export function ConnectPanel({ agent, mcpUrl }: { agent: OwnedAgent; mcpUrl: string }) {
  const tokensPath = agentPath(agent.handle, "/tokens");
  const { data, mutate } = useApi<{ tokens: AgentToken[] }>(tokensPath);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createToken(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>(tokensPath, {
        method: "POST",
        body: { name: name || "Default" },
      });
      setCreated(token);
      setName("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the token.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    await api(agentPath(agent.handle, `/tokens/${id}`), { method: "DELETE" });
    await mutate();
  }

  return (
    <div className="grid gap-6">
      <Card className="p-5 sm:p-6">
        <h2 className="font-medium text-white">Connect an app</h2>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          Add this server URL to any app that supports remote MCP servers. It opens Callsign in your
          browser, where you choose {agent.handle} and approve. No token to copy or paste.
        </p>
        <div className="mt-5">
          <CodeLine value={mcpUrl} />
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {CLIENTS.map((client) => (
          <ClientCard key={client.name} client={client} mcpUrl={mcpUrl} />
        ))}
      </div>

      <Card>
        <h2 className="border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
          Connections
        </h2>
        {data?.tokens.length ? (
          <ul className="divide-y divide-white/5">
            {data.tokens.map((token) => (
              <TokenRow
                key={token.id}
                handle={agent.handle}
                token={token}
                onRevoke={() => revoke(token.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
            {data ? "Nothing is connected yet." : "Loading…"}
          </p>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="font-medium text-white">Use a token instead</h2>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          For apps without sign-in, scripts and the REST API. Create one token per place you connect{" "}
          {agent.handle}, so you can revoke them independently.
        </p>
        <form onSubmit={createToken} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cursor, my server…"
            maxLength={80}
            className="sm:max-w-xs"
          />
          <Button type="submit" loading={creating}>
            Create token
          </Button>
        </form>
        {error && (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {created && (
          <div className="mt-6 grid animate-fade-up gap-4 rounded-xl border border-signal/40 bg-signal/[0.06] p-4">
            <p className="text-sm text-orange-100">
              Copy these now. The token won&apos;t be shown again.
            </p>
            <div className="grid gap-1.5">
              <span className="text-xs text-zinc-400">Server URL and header</span>
              <CodeLine value={mcpUrl} />
              <CodeLine value={`Authorization: Bearer ${created}`} secret />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-zinc-400">
                URL with the token, for apps that only take a URL
              </span>
              <CodeLine value={`${mcpUrl}/${created}`} secret />
            </div>
          </div>
        )}
      </Card>

      <TeachCard agent={agent} />
    </div>
  );
}
