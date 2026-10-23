"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import {
  agentPath,
  api,
  fetcher,
  type LedgerEvent,
  type LedgerVerification,
  type OwnedAgent,
} from "@/lib/api";
import { shortHash } from "@/lib/format";
import { CheckIcon, ShieldIcon } from "../icons";
import { Button, Card, ErrorNote, Spinner } from "../ui";
import { useLiveEvents } from "./hooks";
import { LedgerEntry } from "./ledger-entry";

const PAGE_SIZE = 50;

type Page = { events: LedgerEvent[] };

function VerifyCard({ agent }: { agent: OwnedAgent }) {
  const [result, setResult] = useState<LedgerVerification | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setChecking(true);
    setError(null);
    try {
      setResult(await api<LedgerVerification>(agentPath(agent.handle, "/ledger/verify")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200">
        <ShieldIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-medium text-white">Tamper-evident ledger</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Each entry includes the hash of the one before it. Verifying recomputes the whole chain.
        </p>
        {result &&
          (result.valid ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-300">
              <CheckIcon className="size-4" /> Chain intact · {result.events} entries · head{" "}
              <span className="font-mono">{shortHash(result.head)}</span>
            </p>
          ) : (
            <ErrorNote>Chain broken at entry #{result.brokenAtSeq}.</ErrorNote>
          ))}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <Button variant="secondary" loading={checking} onClick={() => void verify()}>
        Verify chain
      </Button>
    </Card>
  );
}

export function LedgerPanel({ agent }: { agent: OwnedAgent }) {
  const base = agentPath(agent.handle, "/ledger");
  const { data, size, setSize, isValidating, mutate } = useSWRInfinite<Page>(
    (index, previous: Page | null) => {
      if (index === 0) return `${base}?limit=${PAGE_SIZE}`;
      const last = previous?.events.at(-1);
      if (!last || (previous?.events.length ?? 0) < PAGE_SIZE) return null;
      return `${base}?limit=${PAGE_SIZE}&before=${last.seq}`;
    },
    fetcher<Page>,
  );

  useLiveEvents((event) => {
    if (event.agent === agent.handle) void mutate();
  });

  const events = data?.flatMap((page) => page.events) ?? [];
  const hasMore = (data?.at(-1)?.events.length ?? 0) === PAGE_SIZE;

  return (
    <div className="grid gap-6">
      <VerifyCard agent={agent} />
      <Card>
        {!data ? (
          <div className="flex justify-center p-10 text-zinc-500">
            <Spinner />
          </div>
        ) : (
          <ul>
            {events.map((event) => (
              <LedgerEntry key={event.id} event={event} />
            ))}
          </ul>
        )}
      </Card>
      {hasMore && (
        <Button
          variant="secondary"
          className="justify-self-center"
          loading={isValidating}
          onClick={() => void setSize(size + 1)}
        >
          Load older entries
        </Button>
      )}
    </div>
  );
}
