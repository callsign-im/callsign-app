"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, type ConnectionStatus, type ConnectionSummary } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { PlugIcon, PlusIcon } from "../icons";
import { Badge, Button, Card, ErrorNote, Field, Input, Spinner } from "../ui";
import { useApi } from "./hooks";

export const CONNECTION_STATUS: Record<
  ConnectionStatus,
  { label: string; tone: "neutral" | "success" | "danger" }
> = {
  pending: { label: "Signing in", tone: "neutral" },
  active: { label: "Connected", tone: "success" },
  needs_reauth: { label: "Sign in again", tone: "danger" },
  error: { label: "Not answering", tone: "danger" },
};

type AuthKind = "oauth" | "header" | "none";

const AUTH_LABEL: Record<AuthKind, string> = {
  oauth: "Sign in (OAuth)",
  header: "API key header",
  none: "No auth",
};

function AddConnection({ onCancel }: { onCancel?: (() => void) | undefined }) {
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [kind, setKind] = useState<AuthKind>("oauth");
  const [header, setHeader] = useState("Authorization");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api<{ id: string; authorizationUrl: string | null }>(
        "/v1/connections",
        {
          method: "POST",
          body: {
            name,
            serverUrl,
            auth: kind === "header" ? { kind, header, value } : { kind },
          },
        },
      );
      window.location.href = created.authorizationUrl ?? `/dashboard/connections/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect it.");
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-medium text-white">Connect an MCP server</h2>
      <p className="mt-1 max-w-xl text-sm text-zinc-500">
        Callsign signs in once and keeps the credentials sealed. Then you pick which tools your
        agents, or the agents in your groups, may use.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:max-w-xl">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Linear, our CRM…"
            maxLength={60}
            required
          />
        </Field>
        <Field label="Server URL" hint="The server's streamable HTTP endpoint, over https.">
          <Input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://mcp.example.com/mcp"
            inputMode="url"
            required
          />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-zinc-200">How it signs in</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AUTH_LABEL) as AuthKind[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => setKind(option)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  kind === option
                    ? "border-signal/60 bg-signal/10 text-white"
                    : "border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                {AUTH_LABEL[option]}
              </button>
            ))}
          </div>
        </fieldset>
        {kind === "header" && (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field label="Header">
              <Input value={header} onChange={(e) => setHeader(e.target.value)} required />
            </Field>
            <Field label="Value" hint="Stored sealed and never shown again.">
              <Input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Bearer sk_…"
                required
              />
            </Field>
          </div>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            {kind === "oauth" ? "Continue to sign in" : "Connect"}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function ConnectionRow({ connection }: { connection: ConnectionSummary }) {
  const status = CONNECTION_STATUS[connection.status];
  return (
    <Link
      href={`/dashboard/connections/${connection.id}`}
      className="flex items-center gap-4 px-4 py-4 transition hover:bg-white/[0.02] sm:px-5"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <PlugIcon className="size-4 text-zinc-300" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-white">{connection.name}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
          {connection.tools.changed > 0 && <Badge tone="signal">Changed tools</Badge>}
        </span>
        <span className="block truncate text-sm text-zinc-500">
          {connection.host} · {connection.tools.enabled} of {connection.tools.total} tools on
          {connection.toolsSyncedAt && ` · checked ${timeAgo(connection.toolsSyncedAt)}`}
        </span>
      </span>
    </Link>
  );
}

export function ConnectionsPage() {
  const params = useSearchParams();
  const failed = params.get("error");
  const { data } = useApi<{ connections: ConnectionSummary[] }>("/v1/connections");
  const [adding, setAdding] = useState(false);
  const connections = data?.connections;
  const showForm = adding || connections?.length === 0;

  return (
    <div className="grid gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Connections</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            MCP servers you connect once and share with your agents and your #groups, tool by tool.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" /> Connect
          </Button>
        )}
      </div>

      {failed && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
          {failed === "cancelled" || failed === "access_denied"
            ? "The sign-in was cancelled."
            : failed}
        </p>
      )}

      {showForm && (
        <AddConnection onCancel={connections?.length ? () => setAdding(false) : undefined} />
      )}

      {!connections ? (
        <div className="flex justify-center p-10 text-zinc-500">
          <Spinner />
        </div>
      ) : (
        connections.length > 0 && (
          <Card>
            <ul className="divide-y divide-white/5">
              {connections.map((connection) => (
                <li key={connection.id}>
                  <ConnectionRow connection={connection} />
                </li>
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  );
}
