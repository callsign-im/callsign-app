"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ApiError, type LedgerEvent, type Owner, type SessionChange } from "@/lib/api";
import { site } from "@/lib/site";
import { Button, Spinner } from "../ui";
import { LiveEventsContext, OwnerContext, SessionEventsContext, useApi } from "./hooks";

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

function useListeners<T>() {
  const listeners = useRef(new Set<(value: T) => void>());
  const subscribe = useCallback((listener: (value: T) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  return { listeners, subscribe };
}

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const ledger = useListeners<LedgerEvent>();
  const sessions = useListeners<SessionChange>();

  useEffect(() => {
    const source = new EventSource(new URL("/v1/events", site.apiUrl), { withCredentials: true });
    source.addEventListener("ledger", (message) => {
      const { event } = JSON.parse(String(message.data)) as { event: LedgerEvent };
      for (const listener of ledger.listeners.current) listener(event);
    });
    source.addEventListener("session", (message) => {
      const change = JSON.parse(String(message.data)) as SessionChange;
      for (const listener of sessions.listeners.current) listener(change);
    });
    return () => source.close();
  }, [ledger.listeners, sessions.listeners]);

  return (
    <LiveEventsContext value={ledger.subscribe}>
      <SessionEventsContext value={sessions.subscribe}>{children}</SessionEventsContext>
    </LiveEventsContext>
  );
}
