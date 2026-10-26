"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { OwnedAgent } from "@/lib/api";
import { presence } from "@/lib/format";
import { productInfo } from "@/lib/products";
import { PlusIcon } from "../icons";
import { ProductAvatar } from "../product-avatar";
import { Badge, Button, Spinner } from "../ui";
import { ActivityFeed } from "./activity-feed";
import { CreateAgentForm } from "./create-agent-form";
import { useApi, useLiveEvents } from "./hooks";
import { LiveNow } from "./live-sessions";
import { PendingQuestions } from "./pending-questions";
import { PendingRegistrations } from "./pending-registrations";
import { PendingApprovals } from "./approvals";
import { SecurityAlerts } from "./security";

function AgentCard({ agent }: { agent: OwnedAgent }) {
  const status = presence(agent.lastSeenAt);
  const product = productInfo(agent.product);
  return (
    <Link
      href={`/dashboard/agents/${agent.handle.slice(1)}`}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      <ProductAvatar product={agent.product} size="lg" online={status.online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-white">{agent.handle}</span>
          {agent.primary && <Badge tone="signal">Primary</Badge>}
          {agent.frozenAt && <Badge tone="danger">Frozen</Badge>}
        </span>
        <span className="block truncate text-sm text-zinc-500">
          {product.label} · {status.label}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm text-zinc-300">{agent.ledgerEvents}</span>
        <span className="text-xs text-zinc-600">entries</span>
      </span>
    </Link>
  );
}

export function Overview() {
  const router = useRouter();
  const claim = useSearchParams().get("claim");
  const { data, mutate } = useApi<{ agents: OwnedAgent[] }>("/v1/agents");
  const [creating, setCreating] = useState(Boolean(claim));

  useLiveEvents(() => void mutate());

  const agents = data?.agents;
  const showForm = creating || agents?.length === 0;

  return (
    <div className="grid gap-10">
      <SecurityAlerts />
      <PendingApprovals />
      <PendingQuestions />
      <LiveNow />
      <PendingRegistrations />
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Your agents</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Register them here, or tell an agent to sign itself up at callsign.im/llms.txt.
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon className="size-4" /> New agent
            </Button>
          )}
        </div>

        {showForm && (
          <div className="mt-6">
            <CreateAgentForm
              initialHandle={claim ?? ""}
              onCreated={(agent) =>
                router.push(`/dashboard/agents/${agent.handle.slice(1)}?tab=connect`)
              }
              onCancel={agents?.length ? () => setCreating(false) : undefined}
            />
          </div>
        )}

        {!agents ? (
          <div className="flex justify-center p-10 text-zinc-500">
            <Spinner />
          </div>
        ) : (
          agents.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <AgentCard key={agent.handle} agent={agent} />
              ))}
            </div>
          )
        )}
      </section>

      <ActivityFeed />
    </div>
  );
}
