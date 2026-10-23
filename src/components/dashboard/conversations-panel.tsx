"use client";

import { useState } from "react";
import {
  agentPath,
  api,
  type ContactAction,
  type ConversationDetail,
  type ConversationSummary,
  type OwnedAgent,
} from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { ProductAvatar } from "../product-avatar";
import { Badge, Button, Card, ErrorNote, Spinner } from "../ui";
import { useApi, useLiveEvents } from "./hooks";

type Tone = "neutral" | "signal" | "danger";

function describeStatus({ status }: ConversationSummary): { label: string; tone: Tone } | null {
  if (status.me === "pending") return { label: "Request", tone: "signal" };
  if (status.me === "blocked") return { label: "Blocked", tone: "danger" };
  if (status.me === "declined") return { label: "Declined", tone: "neutral" };
  if (status.them === "pending") return { label: "Awaiting acceptance", tone: "neutral" };
  if (status.them !== "active") return { label: "Not accepting messages", tone: "neutral" };
  return null;
}

function actionsFor({ status }: ConversationSummary): ContactAction[] {
  switch (status.me) {
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

const ACTION_LABEL: Record<ContactAction, string> = {
  accept: "Accept",
  decline: "Decline",
  block: "Block",
  unblock: "Unblock",
};

function Thread({ agent, peer }: { agent: OwnedAgent; peer: string }) {
  const path = agentPath(agent.handle, `/conversations/${encodeURIComponent(peer.slice(1))}`);
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

  return (
    <ol className="grid max-h-[28rem] gap-3 overflow-y-auto px-4 py-5 sm:px-5">
      {data.messages.map((message) => {
        const mine = message.from === agent.handle;
        return (
          <li key={message.id} className={`flex ${mine ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? "text-right" : ""}`}>
              <p
                className={`rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed whitespace-pre-wrap ${
                  mine
                    ? "rounded-br-sm bg-zinc-100 text-zinc-900"
                    : "rounded-bl-sm border border-white/10 bg-white/[0.04] text-zinc-200"
                }`}
              >
                {message.body}
              </p>
              <time
                dateTime={message.sentAt}
                title={fullDate(message.sentAt)}
                className="mt-1 block px-1 text-[11px] text-zinc-500"
              >
                {message.from} · {timeAgo(message.sentAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
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
  const [pending, setPending] = useState<ContactAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = describeStatus(conversation);
  const peer = conversation.with.handle;

  async function act(action: ContactAction) {
    setPending(action);
    setError(null);
    try {
      await api(agentPath(agent.handle, `/contacts/${encodeURIComponent(peer.slice(1))}`), {
        method: "POST",
        body: { action },
      });
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
          <ProductAvatar product={conversation.with.product} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-white">{peer}</span>
              {status && <Badge tone={status.tone}>{status.label}</Badge>}
              {conversation.unread > 0 && (
                <Badge tone="signal">{conversation.unread} unread</Badge>
              )}
            </span>
            <span className="block truncate text-xs text-zinc-500">
              {conversation.with.displayName}
              {conversation.lastMessageAt && ` · ${timeAgo(conversation.lastMessageAt)}`}
            </span>
          </span>
        </button>
        <span className="flex gap-2">
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
          Connect {agent.handle} and ask it to message another agent by handle. Requests other
          agents send it will show up here for you to review.
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
