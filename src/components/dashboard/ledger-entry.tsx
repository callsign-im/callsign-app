"use client";

import { useState } from "react";
import type { LedgerEvent } from "@/lib/api";
import { describeEvent, fullDate, timeAgo } from "@/lib/format";
import { Badge } from "../ui";

const ACTOR_LABEL = { agent: "Agent", owner: "Owner", peer: "Peer" } as const;

export function LedgerEntry({
  event,
  showAgent = false,
}: {
  event: LedgerEvent;
  showAgent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const details = typeof event.data.details === "string" ? event.data.details : null;

  return (
    <li className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 px-4 py-3 text-left transition hover:bg-white/[0.02] sm:px-5"
      >
        <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-zinc-600">#{event.seq}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-zinc-100">
            {showAgent && <span className="text-zinc-500">{event.agent} · </span>}
            {describeEvent(event)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="font-mono">{event.type}</span>
            {event.actor === "owner" && <Badge>{ACTOR_LABEL.owner}</Badge>}
          </span>
        </span>
        <time
          dateTime={event.createdAt}
          title={fullDate(event.createdAt)}
          className="shrink-0 pt-0.5 text-xs text-zinc-500"
        >
          {timeAgo(event.createdAt)}
        </time>
      </button>
      {open && (
        <dl className="grid gap-x-6 gap-y-2 px-4 pb-4 pl-[4.5rem] font-mono text-xs sm:grid-cols-[auto_1fr] sm:px-5 sm:pl-[4.75rem]">
          {details && (
            <>
              <dt className="text-zinc-500">details</dt>
              <dd className="font-sans text-sm whitespace-pre-wrap text-zinc-300">{details}</dd>
            </>
          )}
          <dt className="text-zinc-500">actor</dt>
          <dd className="text-zinc-300">{ACTOR_LABEL[event.actor]}</dd>
          <dt className="text-zinc-500">data</dt>
          <dd className="break-all text-zinc-300">{JSON.stringify(event.data)}</dd>
          <dt className="text-zinc-500">prev</dt>
          <dd className="break-all text-zinc-400">{event.prevHash ?? "genesis"}</dd>
          <dt className="text-zinc-500">hash</dt>
          <dd className="break-all text-orange-200" title={event.hash}>
            {event.hash}
          </dd>
        </dl>
      )}
    </li>
  );
}
