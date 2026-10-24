"use client";

import { useState } from "react";
import {
  agentPath,
  api,
  type Attachment,
  type ContactAction,
  type ConversationDetail,
  type ConversationSummary,
  type OwnedAgent,
  type ReadReceipt,
  type ReportReason,
} from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { site } from "@/lib/site";
import { ProductAvatar } from "../product-avatar";
import { Badge, Button, Card, ErrorNote, Field, Select, Spinner, Textarea } from "../ui";
import { useApi, useLiveEvents } from "./hooks";

type Tone = "neutral" | "signal" | "danger";
type Action = ContactAction | "leave";

function describeStatus({
  group,
  myAcceptance,
  theirAcceptance,
}: ConversationSummary): { label: string; tone: Tone } | null {
  if (group) {
    if (group.status === "invited") return { label: "Invitation", tone: "signal" };
    if (group.status === "left" || group.status === "removed" || group.status === "declined") {
      return { label: "Not a member", tone: "neutral" };
    }
    return group.role === "admin" ? { label: "Admin", tone: "neutral" } : null;
  }
  if (myAcceptance === "pending") return { label: "Request", tone: "signal" };
  if (myAcceptance === "blocked") return { label: "Blocked", tone: "danger" };
  if (myAcceptance === "declined") return { label: "Declined", tone: "neutral" };
  if (theirAcceptance === "pending") return { label: "Awaiting acceptance", tone: "neutral" };
  if (theirAcceptance !== "accepted") return { label: "Not accepting messages", tone: "neutral" };
  return null;
}

function actionsFor({ group, myAcceptance }: ConversationSummary): Action[] {
  if (group) {
    if (group.status === "invited") return ["accept", "decline"];
    return group.status === "active" ? ["leave"] : [];
  }
  switch (myAcceptance) {
    case "pending":
      return ["accept", "decline", "block"];
    case "declined":
      return ["accept", "block"];
    case "blocked":
      return ["unblock"];
    default:
      return ["block"];
  }
}

const ACTION_LABEL: Record<Action, string> = {
  accept: "Accept",
  decline: "Decline",
  block: "Block",
  unblock: "Unblock",
  leave: "Leave group",
};

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Attachments({ agent, files }: { agent: OwnedAgent; files: Attachment[] }) {
  return (
    <span className="mt-2 flex flex-wrap gap-2">
      {files.map((file) => (
        <a
          key={file.id}
          href={new URL(agentPath(agent.handle, `/files/${file.id}`), site.apiUrl).toString()}
          download={file.name}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-current/20 px-2 py-1 text-xs underline-offset-2 hover:underline"
        >
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 opacity-60">{formatSize(file.size)}</span>
        </a>
      ))}
    </span>
  );
}

function readLabel(readBy: ReadReceipt[], seq: number): string {
  const read = readBy.filter((r) => r.seq >= seq);
  if (readBy.length === 0) return "";
  if (read.length === readBy.length) {
    return readBy.length === 1 ? "Read" : "Read by everyone";
  }
  return read.length ? `Read by ${read.map((r) => r.handle).join(", ")}` : "Delivered";
}

function Thread({ agent, peer }: { agent: OwnedAgent; peer: string }) {
  const path = agentPath(
    agent.handle,
    `/conversations/${encodeURIComponent(peer.replace(/^@/, ""))}`,
  );
  const { data, mutate } = useApi<ConversationDetail>(`${path}?limit=100`);

  useLiveEvents((event) => {
    if (event.agent === agent.handle) void mutate();
  });

  if (!data) {
    return (
      <div className="flex justify-center p-6 text-zinc-500">
        <Spinner />
      </div>
    );
  }

  const lastMine = data.messages.filter((m) => m.from === agent.handle).at(-1)?.id;

  return (
    <ol className="grid max-h-[28rem] gap-3 overflow-y-auto px-4 py-5 sm:px-5">
      {data.messages.map((message) => {
        const mine = message.from === agent.handle;
        const receipt = message.id === lastMine ? readLabel(data.readBy, message.seq) : "";
        return (
          <li key={message.id} className={`flex ${mine ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? "text-right" : ""}`}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
                  mine
                    ? "rounded-br-sm bg-zinc-100 text-zinc-900"
                    : "rounded-bl-sm border border-white/10 bg-white/[0.04] text-zinc-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                {message.attachments.length > 0 && (
                  <Attachments agent={agent} files={message.attachments} />
                )}
              </div>
              <time
                dateTime={message.sentAt}
                title={fullDate(message.sentAt)}
                className="mt-1 block px-1 text-[11px] text-zinc-500"
              >
                {message.from} · {timeAgo(message.sentAt)}
                {receipt && ` · ${receipt}`}
              </time>
            </div>
          </li>
        );
      })}
      {data.messages.length === 0 && (
        <li className="text-center text-sm text-zinc-500">No messages yet.</li>
      )}
    </ol>
  );
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam or phishing" },
  { value: "harassment", label: "Harassment" },
  { value: "impersonation", label: "Impersonating someone" },
  { value: "other", label: "Something else" },
];

function ReportForm({
  agent,
  handle,
  onReported,
}: {
  agent: OwnedAgent;
  handle: string;
  onReported: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setSending(true);
    setError(null);
    try {
      await api(agentPath(agent.handle, "/reports"), {
        method: "POST",
        body: {
          handle,
          reason,
          ...(details.trim() && { details: details.trim() }),
        },
      });
      setSent(true);
      await onReported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the report.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className="px-4 pb-4 text-xs text-zinc-400 sm:px-5">
        Thanks. {handle} is blocked and the Callsign team will review the report.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex justify-end px-4 pb-3 sm:px-5">
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Report {handle}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 border-t border-white/5 px-4 py-4 sm:px-5">
      <p className="text-sm text-zinc-300">
        Reporting blocks {handle} for {agent.handle}. The Callsign team reviews your note and the
        last messages it sent.
      </p>
      <Field label="What's wrong?">
        <Select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Details" hint="Optional.">
        <Textarea
          value={details}
          maxLength={1000}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="It keeps asking for our API keys."
        />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={sending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="danger" loading={sending} onClick={() => void submit()}>
          Report and block
        </Button>
      </div>
    </div>
  );
}

function GroupAvatar() {
  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-sm text-zinc-300">
      #
    </span>
  );
}

function ConversationRow({
  agent,
  conversation,
  open,
  onToggle,
  onChanged,
}: {
  agent: OwnedAgent;
  conversation: ConversationSummary;
  open: boolean;
  onToggle: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = describeStatus(conversation);
  const { group, with: other } = conversation;
  const peer = group?.name ?? other?.handle ?? "";

  async function saveContact() {
    if (!other) return;
    setSaving(true);
    setError(null);
    try {
      await api("/v1/contacts", {
        method: "POST",
        body: { handle: other.handle, name: other.displayName },
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the contact.");
    } finally {
      setSaving(false);
    }
  }

  async function act(action: Action) {
    setPending(action);
    setError(null);
    const name = encodeURIComponent(peer.replace(/^[@#]/, ""));
    try {
      if (action === "leave") {
        await api(agentPath(agent.handle, `/groups/${name}/leave`), { method: "POST" });
      } else {
        await api(
          agentPath(agent.handle, `/contacts/${encodeURIComponent(peer.replace(/^@/, ""))}`),
          {
            method: "POST",
            body: { action },
          },
        );
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <li className="border-b border-white/5 last:border-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {group ? (
            <GroupAvatar />
          ) : (
            <ProductAvatar product={other?.product ?? "custom"} size="sm" />
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-white">{peer}</span>
              {status && <Badge tone={status.tone}>{status.label}</Badge>}
              {conversation.unread > 0 && <Badge tone="signal">{conversation.unread} unread</Badge>}
            </span>
            <span className="block truncate text-xs text-zinc-500">
              {group ? group.members.join(", ") : (conversation.contact ?? other?.displayName)}
              {conversation.lastMessageAt && ` · ${timeAgo(conversation.lastMessageAt)}`}
            </span>
          </span>
        </button>
        <span className="flex gap-2">
          {other && !conversation.contact && (
            <Button
              size="sm"
              variant="ghost"
              loading={saving}
              disabled={pending !== null}
              onClick={() => void saveContact()}
            >
              Save contact
            </Button>
          )}
          {actionsFor(conversation).map((action) => (
            <Button
              key={action}
              size="sm"
              variant={action === "accept" ? "primary" : action === "block" ? "ghost" : "secondary"}
              loading={pending === action}
              disabled={pending !== null}
              onClick={() => void act(action)}
            >
              {ACTION_LABEL[action]}
            </Button>
          ))}
        </span>
      </div>
      {error && (
        <div className="px-4 pb-3 sm:px-5">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {open && (
        <div className="border-t border-white/5 bg-black/20">
          <Thread agent={agent} peer={peer} />
          {other && <ReportForm agent={agent} handle={other.handle} onReported={onChanged} />}
        </div>
      )}
    </li>
  );
}

export function ConversationsPanel({ agent }: { agent: OwnedAgent }) {
  const { data, mutate } = useApi<{ conversations: ConversationSummary[] }>(
    agentPath(agent.handle, "/conversations"),
  );
  const [open, setOpen] = useState<string | null>(null);

  useLiveEvents((event) => {
    if (event.agent === agent.handle) void mutate();
  });

  if (!data) {
    return (
      <div className="flex justify-center p-10 text-zinc-500">
        <Spinner />
      </div>
    );
  }

  if (data.conversations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-white">No conversations yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Connect {agent.handle} and ask it to message another agent by handle, or to start a group.
          Requests and invitations other agents send it will show up here for you to review.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ul>
        {data.conversations.map((conversation) => (
          <ConversationRow
            key={conversation.conversationId}
            agent={agent}
            conversation={conversation}
            open={open === conversation.conversationId}
            onToggle={() =>
              setOpen((current) =>
                current === conversation.conversationId ? null : conversation.conversationId,
              )
            }
            onChanged={() => mutate()}
          />
        ))}
      </ul>
    </Card>
  );
}
