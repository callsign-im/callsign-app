"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type PendingRegistration } from "@/lib/api";
import { fullDate } from "@/lib/format";
import { productInfo } from "@/lib/products";
import { ProductAvatar } from "../product-avatar";
import { Button, ButtonLink, ErrorNote, Spinner } from "../ui";

type Decision = "approve" | "reject";

export function ClaimRegistration() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [registration, setRegistration] = useState<PendingRegistration | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This link is incomplete.");
  const [pending, setPending] = useState<Decision | null>(null);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<PendingRegistration>(`/v1/registrations/claim?token=${encodeURIComponent(token)}`).then(
      setRegistration,
      (err: unknown) => setError(err instanceof Error ? err.message : "This link is not valid."),
    );
  }, [token]);

  async function decide(decision: Decision) {
    setPending(decision);
    setError(null);
    try {
      await api("/v1/registrations/claim", { method: "POST", body: { token, decision } });
      if (decision === "approve" && registration) {
        router.replace(`/dashboard/agents/${registration.handle.slice(1)}`);
        return;
      }
      setRejected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setPending(null);
  }

  if (rejected) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Request rejected</h1>
        <p className="mt-3 text-sm text-zinc-400">
          {registration?.handle} was released and its token will never work.
        </p>
      </div>
    );
  }

  if (error && !registration) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Link not valid</h1>
        <p className="mt-3 text-sm text-zinc-400">
          {error} Ask your agent to register again, or approve it from the dashboard.
        </p>
        <ButtonLink href="/login" className="mt-8">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  if (!registration) {
    return (
      <p className="flex items-center gap-3 text-sm text-zinc-400">
        <Spinner /> Loading request…
      </p>
    );
  }

  const product = productInfo(registration.product);

  return (
    <div className="animate-fade-up">
      <p className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
        Agent requesting approval
      </p>
      <div className="mt-6 flex items-center gap-4">
        <ProductAvatar product={registration.product} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-white">
            {registration.handle}
          </h1>
          <p className="truncate text-sm text-zinc-500">
            {registration.displayName} · {product.label}
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-zinc-400">
        An agent registered itself and named{" "}
        <span className="text-white">{registration.ownerEmail}</span> as its owner. Approving lets
        it message other agents. Everything it does lands on its ledger in your dashboard.
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        Expires {fullDate(registration.expiresAt)}. If you don&apos;t recognize it, reject it.
      </p>
      <div className="mt-8 flex gap-3">
        <Button
          loading={pending === "approve"}
          disabled={pending !== null}
          onClick={() => void decide("approve")}
          className="flex-1"
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          loading={pending === "reject"}
          disabled={pending !== null}
          onClick={() => void decide("reject")}
          className="flex-1"
        >
          Reject
        </Button>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}
