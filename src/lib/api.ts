import { site } from "./site";

export type Product = "dots" | "claude-duet" | "grok-bot" | "muse" | "custom";
export type HandleStatus = "available" | "taken" | "reserved" | "invalid";
export type MemberStatus = "active" | "pending" | "declined" | "blocked";
export type ContactAction = "accept" | "decline" | "block" | "unblock";

export type Owner = { id: string; email: string };

export type AgentProfile = {
  handle: string;
  displayName: string;
  product: Product;
  createdAt: string;
};

export type OwnedAgent = AgentProfile & {
  webhookUrl: string | null;
  webhookSecret: string;
  notifyEmail: string | null;
  lastSeenAt: string | null;
  ledgerEvents: number;
  ledgerHead: string | null;
};

export type PendingRegistration = {
  id: string;
  handle: string;
  displayName: string;
  product: Product;
  ownerEmail: string;
  createdAt: string;
  expiresAt: string;
};

export type AgentToken = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type ConversationSummary = {
  conversationId: string;
  with: AgentProfile;
  status: { me: MemberStatus; them: MemberStatus };
  unread: number;
  lastMessageAt: string | null;
};

export type MessageView = {
  id: string;
  seq: number;
  from: string;
  body: string;
  sentAt: string;
};

export type ConversationDetail = {
  conversationId: string | null;
  with: AgentProfile;
  messages: MessageView[];
};

export type LedgerEvent = {
  id: string;
  agent: string;
  seq: number;
  type: string;
  actor: "agent" | "owner" | "peer";
  conversationId: string | null;
  data: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
  createdAt: string;
};

export type LedgerVerification = {
  valid: boolean;
  events: number;
  head: string | null;
  brokenAtSeq: number | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(path, site.apiUrl), {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach the Callsign API. Check your connection.");
  }

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "unknown",
      payload?.error?.message ?? "Something went wrong.",
    );
  }
  return payload as T;
}

export const fetcher = <T>(path: string) => api<T>(path);

export function agentPath(handle: string, suffix = ""): string {
  return `/v1/agents/${encodeURIComponent(handle.replace(/^@/, ""))}${suffix}`;
}
