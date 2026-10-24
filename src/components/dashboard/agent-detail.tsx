"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { agentPath, type OwnedAgent } from "@/lib/api";
import { presence } from "@/lib/format";
import { productInfo } from "@/lib/products";
import { ArrowRightIcon } from "../icons";
import { ProductAvatar } from "../product-avatar";
import { Badge, ButtonLink, Card, Spinner } from "../ui";
import { ConnectPanel } from "./connect-panel";
import { ConversationsPanel } from "./conversations-panel";
import { useApi, useLiveEvents } from "./hooks";
import { LedgerPanel } from "./ledger-panel";
import { PlansPanel } from "./plans-panel";
import { SettingsPanel } from "./settings-panel";
import { WakeUpsPanel } from "./wake-ups-panel";

const TABS = [
  { id: "conversations", label: "Conversations" },
  { id: "plans", label: "Plans" },
  { id: "connect", label: "Connect" },
  { id: "wake-ups", label: "Wake-ups" },
  { id: "ledger", label: "Ledger" },
  { id: "settings", label: "Settings" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function isTab(value: string | null): value is Tab {
  return TABS.some((tab) => tab.id === value);
}

export function AgentDetail() {
  const { handle } = useParams<{ handle: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");
  const tab: Tab = isTab(requested) ? requested : "conversations";
  const { data, error, mutate } = useApi<{ agent: OwnedAgent; mcpUrl: string }>(agentPath(handle));

  useLiveEvents((event) => {
    if (event.agent === `@${handle}`) void mutate();
  });

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-zinc-300">{error.message}</p>
        <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
          Back to your agents
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

  const { agent, mcpUrl } = data;
  const status = presence(agent.lastSeenAt);
  const product = productInfo(agent.product);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowRightIcon className="size-3.5 rotate-180" /> Agents
        </Link>
        <div className="mt-5 flex items-center gap-4">
          <ProductAvatar product={agent.product} size="lg" online={status.online} />
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-white">
              <span className="truncate">{agent.handle}</span>
              {agent.primary && <Badge tone="signal">Primary</Badge>}
            </h1>
            <p className="truncate text-sm text-zinc-500">
              {agent.displayName} · {product.label} · {status.label}
            </p>
          </div>
        </div>
      </div>

      <nav
        role="tablist"
        aria-label="Agent sections"
        className="flex gap-1 overflow-x-auto border-b border-white/10"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => router.replace(`${pathname}?tab=${id}`, { scroll: false })}
            className={`relative shrink-0 px-3 py-2.5 text-sm transition ${
              tab === id ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
            {tab === id && <span className="absolute inset-x-3 -bottom-px h-px bg-signal" />}
          </button>
        ))}
      </nav>

      {tab === "conversations" && <ConversationsPanel agent={agent} />}
      {tab === "plans" && <PlansPanel agent={agent} />}
      {tab === "connect" && <ConnectPanel agent={agent} mcpUrl={mcpUrl} />}
      {tab === "wake-ups" && (
        <WakeUpsPanel agent={agent} mcpUrl={mcpUrl} onSaved={() => void mutate()} />
      )}
      {tab === "ledger" && <LedgerPanel agent={agent} />}
      {tab === "settings" && <SettingsPanel agent={agent} onSaved={() => void mutate()} />}
    </div>
  );
}
