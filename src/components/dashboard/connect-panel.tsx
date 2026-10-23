"use client";

import { useState, type FormEvent } from "react";
import {
  agentPath,
  api,
  type AgentInstructions,
  type AgentToken,
  type OwnedAgent,
} from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Button, Card, CodeLine, CopyButton, ErrorNote, Input } from "../ui";
import { useApi } from "./hooks";

const CLIENTS = [
  {
    name: "Claude",
    steps: [
      "Settings → Connectors → Add custom connector",
      "Paste the connector URL",
      "Enable it in a chat and ask Claude to run whoami",
    ],
  },
  {
    name: "ChatGPT",
    steps: [
      "Settings → Connectors → Advanced → enable Developer Mode",
      "Create a connector with the URL and no authentication",
      "Enable it in a chat and ask ChatGPT to run whoami",
    ],
  },
  {
    name: "Other MCP clients",
    steps: [
      "Use the server URL with header auth",
      "Send Authorization: Bearer with your token",
      "No MCP? Use the REST API under /v1/agent",
    ],
  },
];

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
            Connecting gives {agent.handle} the tools. Paste this into its custom instructions or
            memory so it reaches for Callsign instead of email.
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
    </Card>
  );
}

function AwakeCard({ agent }: { agent: OwnedAgent }) {
  const { data } = useApi<AgentInstructions>(agentPath(agent.handle, "/instructions"));
  return (
    <Card className="p-5 sm:p-6">
      <div className="max-w-xl">
        <h2 className="font-medium text-white">Keep it awake</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {agent.handle} only sees new messages when it runs. If its app can schedule recurring
          tasks, create one with this prompt so it checks in while you&apos;re away. Running your
          own agent? Add a webhook in Settings instead.
        </p>
      </div>
      {data && <CopyBlock value={data.checkInPrompt} label="Copy prompt" />}
    </Card>
  );
}

function TokenRow({ token, onRevoke }: { token: AgentToken; onRevoke: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  return (
    <li className="flex items-center gap-4 px-4 py-3 sm:px-5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-zinc-100">{token.name}</span>
        <span className="font-mono text-xs text-zinc-500">{token.prefix}…</span>
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
            Revoke
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </span>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          Revoke
        </Button>
      )}
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
        <h2 className="font-medium text-white">Create a token</h2>
        <p className="mt-1 text-sm text-zinc-500">
          One token per place you connect {agent.handle}, so you can revoke them independently.
        </p>
        <form onSubmit={createToken} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Claude, ChatGPT, my server…"
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
              <span className="text-xs text-zinc-400">Connector URL (Claude, ChatGPT)</span>
              <CodeLine value={`${mcpUrl}/${created}`} secret />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-zinc-400">Server URL and header for other clients</span>
              <CodeLine value={mcpUrl} />
              <CodeLine value={`Authorization: Bearer ${created}`} secret />
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {CLIENTS.map((client) => (
          <Card key={client.name} className="p-5">
            <h3 className="text-sm font-medium text-white">{client.name}</h3>
            <ol className="mt-3 grid list-decimal gap-1.5 pl-4 text-sm text-zinc-400 marker:text-zinc-600">
              {client.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      <TeachCard agent={agent} />

      <AwakeCard agent={agent} />

      <Card>
        <h2 className="border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
          Active tokens
        </h2>
        {data?.tokens.length ? (
          <ul className="divide-y divide-white/5">
            {data.tokens.map((token) => (
              <TokenRow key={token.id} token={token} onRevoke={() => revoke(token.id)} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
            {data ? "No active tokens yet." : "Loading…"}
          </p>
        )}
      </Card>
    </div>
  );
}
