"use client";

import Link from "next/link";
import { useState } from "react";
import { agentPath, api, type AgentTools, type OwnedAgent } from "@/lib/api";
import { Badge, Card, ErrorNote, Toggle } from "../ui";
import { useApi } from "./hooks";

export function AgentToolsPanel({ agent }: { agent: OwnedAgent }) {
  const { data, mutate } = useApi<AgentTools>(agentPath(agent.handle, "/tools"));
  const [error, setError] = useState<string | null>(null);

  async function update(path: string, enabled: boolean) {
    setError(null);
    try {
      await api(agentPath(agent.handle, path), { method: "PUT", body: { enabled } });
      await mutate();
    } catch (err) {
      if (!(err instanceof Error && "code" in err && err.code === "step_up_cancelled")) {
        setError(err instanceof Error ? err.message : "Couldn't save it.");
      }
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="border-b border-white/5 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-medium text-white">Tools it can use</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            From your{" "}
            <Link
              href="/dashboard/connections"
              className="text-zinc-300 underline underline-offset-4"
            >
              connections
            </Link>{" "}
            and from tools others share in its groups. It sees them in MCP as connection__tool.
          </p>
        </div>
        {data?.tools.length ? (
          <ul className="divide-y divide-white/5">
            {data.tools.map((tool) => (
              <li key={tool.name} className="px-4 py-3 sm:px-5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-zinc-100">{tool.name}</span>
                  <Badge tone={tool.write ? "signal" : "neutral"}>
                    {tool.write ? "Can change things" : "Read-only"}
                  </Badge>
                </span>
                <span className="block text-xs text-zinc-500">
                  {tool.connection}
                  {tool.sharedBy && ` · shared by ${tool.sharedBy} in ${tool.group}`}
                  {tool.description && ` · ${tool.description}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
            {data ? "No connected tools yet." : "Loading…"}
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-medium text-white">Tools shared in its groups</h2>
            <p className="mt-0.5 max-w-xl text-xs text-zinc-500">
              Calls run with the sharing owner&apos;s access, and that owner sees what{" "}
              {agent.handle} sends to them.
            </p>
          </div>
          {data && (
            <Toggle
              checked={data.sharedTools}
              onChange={(enabled) => void update("/shared-tools", enabled)}
              label="Use tools shared in its groups"
            />
          )}
        </div>
        {data?.shares.length ? (
          <ul className="divide-y divide-white/5">
            {data.shares.map((share) => (
              <li
                key={share.id}
                className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm text-zinc-100">
                    {share.connection}
                    {share.paused && <Badge>Paused</Badge>}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {share.sharedBy} in {share.group} · {share.tools.join(", ")}
                  </span>
                </span>
                <Toggle
                  checked={share.enabled && data.sharedTools}
                  onChange={(enabled) => void update(`/shared-tools/${share.id}`, enabled)}
                  label={`Use ${share.connection} from ${share.sharedBy}`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-sm text-zinc-500 sm:px-5">
            {data ? "Nobody shared tools in its groups." : "Loading…"}
          </p>
        )}
        {error && (
          <div className="px-4 pb-4 sm:px-5">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </Card>
    </div>
  );
}
