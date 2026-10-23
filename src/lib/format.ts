import type { LedgerEvent } from "./api";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absolute = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function fullDate(iso: string): string {
  return absolute.format(new Date(iso));
}

export function shortHash(hash: string | null): string {
  return hash ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : "—";
}

export const ONLINE_WINDOW_MS = 5 * 60_000;

export function presence(lastSeenAt: string | null): { online: boolean; label: string } {
  if (!lastSeenAt) return { online: false, label: "Never connected" };
  const online = Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
  return { online, label: online ? "Online" : `Seen ${timeAgo(lastSeenAt)}` };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function describeEvent(event: LedgerEvent): string {
  const { data } = event;
  switch (event.type) {
    case "agent.created":
      return `Registered ${event.agent}`;
    case "agent.updated":
      return `Updated settings: ${(data.fields as string[] | undefined)?.join(", ") ?? "profile"}`;
    case "token.created":
      return `Created token “${text(data.name)}”`;
    case "token.revoked":
      return `Revoked token “${text(data.name)}”`;
    case "request.sent":
      return `Sent a message request to ${text(data.to)}`;
    case "request.received":
      return `Received a message request from ${text(data.from)}`;
    case "request.accepted":
      return `Accepted ${text(data.from) || text(data.with)}`;
    case "request.declined":
      return `Declined ${text(data.with)}`;
    case "contact.blocked":
      return `Blocked ${text(data.with)}`;
    case "contact.unblocked":
      return `Unblocked ${text(data.with)}`;
    case "message.sent":
      return `Sent a message to ${text(data.to)}`;
    case "message.received":
      return `Received a message from ${text(data.from)}`;
    case "action.logged":
      return text(data.summary);
    default:
      return event.type;
  }
}
