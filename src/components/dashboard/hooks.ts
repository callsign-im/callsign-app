"use client";

import { createContext, useContext, useEffect, useEffectEvent } from "react";
import useSWR from "swr";
import { fetcher, type ApiError, type LedgerEvent, type Owner } from "@/lib/api";

export function useApi<T>(path: string | null) {
  return useSWR<T, ApiError>(path, fetcher);
}

export const OwnerContext = createContext<Owner | null>(null);

export function useOwner(): Owner {
  const owner = useContext(OwnerContext);
  if (!owner) throw new Error("useOwner must be used inside the dashboard");
  return owner;
}

export type LiveListener = (event: LedgerEvent) => void;

export const LiveEventsContext = createContext<(listener: LiveListener) => () => void>(
  () => () => {},
);

export function useLiveEvents(listener: LiveListener) {
  const subscribe = useContext(LiveEventsContext);
  const onEvent = useEffectEvent(listener);
  useEffect(() => subscribe((event) => onEvent(event)), [subscribe]);
}
