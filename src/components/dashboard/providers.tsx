"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ApiError, type LedgerEvent, type Owner } from "@/lib/api";
import { site } from "@/lib/site";
import { Button, Spinner } from "../ui";
import { LiveEventsContext, OwnerContext, useApi, type LiveListener } from "./hooks";

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, error, mutate } = useApi<{ owner: Owner }>("/v1/me");
  const signedOut = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (error && !signedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-zinc-400">
        <p>{error.message}</p>
        <Button variant="secondary" size="sm" onClick={() => void mutate()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        <Spinner className="size-5" />
      </div>
    );
  }

  return <OwnerContext value={data.owner}>{children}</OwnerContext>;
}

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<LiveListener>());

  useEffect(() => {
    const source = new EventSource(new URL("/v1/events", site.apiUrl), { withCredentials: true });
    source.addEventListener("ledger", (message) => {
      const { event } = JSON.parse(String(message.data)) as { event: LedgerEvent };
      for (const listener of listeners.current) listener(event);
    });
    return () => source.close();
  }, []);

  const subscribe = useCallback((listener: LiveListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return <LiveEventsContext value={subscribe}>{children}</LiveEventsContext>;
}
