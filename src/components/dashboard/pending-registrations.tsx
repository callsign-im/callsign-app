"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { api, type PendingRegistration } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { productInfo } from "@/lib/products";
import { RULES_TEMPLATE } from "@/lib/rules";
import { ProductAvatar } from "../product-avatar";
import { RulesField } from "../rules-field";
import { Badge, Button, Card, ErrorNote } from "../ui";
import { useApi } from "./hooks";

function PendingRow({
  registration,
  onDecided,
}: {
  registration: PendingRegistration;
  onDecided: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [rules, setRules] = useState(RULES_TEMPLATE);

  async function decide(decision: "approve" | "reject") {
    setPending(decision);
    setError(null);
    try {
      await api(`/v1/registrations/${registration.id}`, {
        method: "POST",
        body: { decision, ...(decision === "approve" && { rules }) },
      });
      await onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(null);
    }
  }

  return (
    <li className="grid gap-4 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
        <ProductAvatar product={registration.product} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-white">{registration.handle}</span>
            <Badge tone="signal">Self-registered</Badge>
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {productInfo(registration.product).label} · requested {timeAgo(registration.createdAt)}
          </span>
          {registration.description && (
            <span className="mt-1 block text-sm text-zinc-400">{registration.description}</span>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
        </span>
        <span className="flex gap-2">
          <Button
            size="sm"
            loading={pending === "approve"}
            disabled={pending !== null}
            onClick={() => (reviewing ? void decide("approve") : setReviewing(true))}
          >
            {reviewing ? "Approve with these rules" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={pending === "reject"}
            disabled={pending !== null}
            onClick={() => void decide("reject")}
          >
            Reject
          </Button>
        </span>
      </div>
      {reviewing && <RulesField value={rules} onChange={setRules} />}
    </li>
  );
}

export function PendingRegistrations() {
  const { mutate: revalidate } = useSWRConfig();
  const { data, mutate } = useApi<{ registrations: PendingRegistration[] }>("/v1/registrations");

  if (!data?.registrations.length) return null;

  return (
    <Card className="border-signal/30">
      <header className="border-b border-white/5 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-medium text-white">Waiting for your approval</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          These agents registered themselves and named you as their owner.
        </p>
      </header>
      <ul className="divide-y divide-white/5">
        {data.registrations.map((registration) => (
          <PendingRow
            key={registration.id}
            registration={registration}
            onDecided={() => Promise.all([mutate(), revalidate("/v1/agents")])}
          />
        ))}
      </ul>
    </Card>
  );
}
