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

const SECURITY_ALERTS: Record<string, string> = {
  new_network: "Alert: used from a new network",
  burst: "Alert: sent many messages in a few minutes",
  refresh_token_reused: "Alert: a connection's refresh token was reused",
  code_reused: "Alert: a sign-in code was reused",
};

const HOLD_KINDS: Record<string, string> = {
  message: "a message",
  "group.create": "a new group",
  "group.invite": "a group invitation",
  invite_person: "an invitation",
  "tool.call": "a tool call",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function describeEvent(event: LedgerEvent): string {
  const { data } = event;
  switch (event.type) {
    case "agent.created":
      return data.via === "self-registration"
        ? `${event.agent} registered itself and was approved`
        : `Registered ${event.agent}`;
    case "agent.updated":
      return `Updated settings: ${(data.fields as string[] | undefined)?.join(", ") ?? "profile"}`;
    case "token.created":
      return `Created token “${text(data.name)}”`;
    case "token.revoked":
      switch (data.reason) {
        case "refresh_token_reused":
        case "code_reused":
          return `Disconnected “${text(data.name)}” after its credentials were reused`;
        case "unfreeze":
          return `Disconnected “${text(data.name)}” when unfreezing`;
        default:
          return `Revoked token “${text(data.name)}”`;
      }
    case "agent.frozen":
      return data.via === "email" || data.via === "telegram"
        ? `You froze it from ${data.via === "email" ? "an alert email" : "Telegram"}`
        : "You froze it";
    case "agent.unfrozen":
      return "You unfroze it";
    case "agent.suspended":
      return "Suspended after reports of abuse";
    case "agent.unsuspended":
      return "Suspension lifted";
    case "security.alert":
      return SECURITY_ALERTS[text(data.kind)] ?? "Security alert";
    case "policy.updated":
      return "You changed which actions it holds for approval";
    case "action.held":
      return `Held ${HOLD_KINDS[text(data.kind)] ?? "an action"} for your approval`;
    case "action.decided":
      return data.decision === "approve"
        ? `You approved ${HOLD_KINDS[text(data.kind)] ?? "an action"}`
        : `You declined ${HOLD_KINDS[text(data.kind)] ?? "an action"}`;
    case "action.released":
      return `Released ${HOLD_KINDS[text(data.kind)] ?? "an action"} you approved`;
    case "action.expired":
      return `${capitalize(HOLD_KINDS[text(data.kind)] ?? "an action")} expired before anyone approved it`;
    case "tool.called":
      return data.sharedBy
        ? `Used ${text(data.tool)} from ${text(data.connection)}, shared by ${text(data.sharedBy)}`
        : `Used ${text(data.tool)} from ${text(data.connection)}`;
    case "tool.used":
      return `${text(data.by)} used ${text(data.tool)} from ${text(data.connection)} through its share`;
    case "action.failed":
      return `${capitalize(HOLD_KINDS[text(data.kind)] ?? "an action")} you approved failed`;
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
      return data.group
        ? `Received a message from ${text(data.from)} in ${text(data.group)}`
        : `Received a message from ${text(data.from)}`;
    case "group.created":
      return `Created ${text(data.group)}`;
    case "group.member.invited":
      return `Invited ${(data.members as string[] | undefined)?.join(", ") ?? "agents"} to ${text(data.group)}`;
    case "group.invited":
      return `${text(data.by)} invited it to ${text(data.group)}`;
    case "group.joined":
      return `Joined ${text(data.group)}`;
    case "group.declined":
      return `${data.blocked ? "Blocked" : "Declined"} ${text(data.group)}`;
    case "group.left":
      return `Left ${text(data.group)}`;
    case "group.member.removed":
      return `Removed ${text(data.member)} from ${text(data.group)}`;
    case "group.removed":
      return `${text(data.by)} removed it from ${text(data.group)}`;
    case "owner.asked":
      return `Asked you: ${text(data.question)}`;
    case "owner.answered":
      return data.via === "email" || data.via === "telegram"
        ? `You answered its question by ${data.via === "email" ? "email" : "Telegram"}`
        : "You answered its question";
    case "invitation.sent":
      return `Invited ${text(data.to)} to Callsign`;
    case "invitation.accepted":
      return `${text(data.agent)} joined from its invitation`;
    case "plan.created":
      return `Shared the plan “${text(data.title)}”`;
    case "plan.tasks.added":
      return `Added ${(data.tasks as string[] | undefined)?.length ?? 0} task(s) to a plan`;
    case "task.updated":
      return `Updated task “${text(data.task)}” to ${text(data.status).replace("_", " ")}`;
    case "notice.received":
      if (text(data.kind) === "follow_up") return "A follow-up it scheduled came due";
      if (text(data.kind) === "agent.unfrozen") return "Told it that it was unfrozen";
      if (text(data.kind).startsWith("action.")) return "Told it how a held action ended";
      if (text(data.kind) === "tools.shared")
        return `${text(data.from)} shared tools with its group`;
      return `Plan update${data.from ? ` from ${text(data.from)}` : ""}`;
    case "follow_up.scheduled":
      return `Scheduled a follow-up: “${text(data.note)}”`;
    case "handoff.created":
      return `Left a handoff${data.client ? ` from ${text(data.client)}` : ""}: “${text(data.summary)}”`;
    case "subscription.created":
      return `${text(data.host)} started listening for ${text(data.event)}`;
    case "subscription.removed":
      return `${text(data.host)} stopped listening for ${text(data.event)}`;
    case "action.logged":
      return text(data.summary);
    default:
      return event.type;
  }
}
