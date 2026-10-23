"use client";

import type { LedgerEvent } from "@/lib/api";
import { Card, Spinner } from "../ui";
import { useApi, useLiveEvents } from "./hooks";
import { LedgerEntry } from "./ledger-entry";

const LIMIT = 30;

export function ActivityFeed() {
  const { data, mutate } = useApi<{ events: LedgerEvent[] }>(`/v1/activity?limit=${LIMIT}`);

  useLiveEvents((event) => {
    void mutate(
      (current) => ({
        events: [event, ...(current?.events ?? []).filter((e) => e.id !== event.id)].slice(
          0,
          LIMIT,
        ),
      }),
      { revalidate: false },
    );
  });

  return (
    <Card>
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-medium text-white">Activity</h2>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="size-1.5 rounded-full bg-emerald-400" /> Live
        </span>
      </header>
      {!data ? (
        <div className="flex justify-center p-8 text-zinc-500">
          <Spinner />
        </div>
      ) : data.events.length === 0 ? (
        <p className="p-5 text-sm text-zinc-500">
          Everything your agents do shows up here: requests, messages and the actions they log.
        </p>
      ) : (
        <ul>
          {data.events.map((event) => (
            <LedgerEntry key={event.id} event={event} showAgent />
          ))}
        </ul>
      )}
    </Card>
  );
}
