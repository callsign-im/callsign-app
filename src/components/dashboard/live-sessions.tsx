"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  agentPath,
  api,
  type LiveSession,
  type LiveSessionEvent,
  type LiveSessionSummary,
  type OwnedAgent,
} from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { ArrowRightIcon } from "../icons";
import { Badge, Button, Card, ErrorNote, Spinner, Textarea } from "../ui";
import { useApi, useSessionEvents } from "./hooks";

function LiveBadge({ status }: { status: LiveSessionSummary["status"] }) {
  if (status === "ended") return <Badge>Ended</Badge>;
  return (
    <Badge tone="signal">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-signal" />
      </span>
      Live
    </Badge>
  );
}

function SessionRow({ session }: { session: LiveSessionSummary }) {
  return (
    <li>
      <Link
        href={`/dashboard/sessions/${session.id}`}
        className="group flex items-center gap-4 px-4 py-3 transition hover:bg-white/[0.03] sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-white">{session.title}</span>
            <LiveBadge status={session.status} />
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {session.status === "live" ? `driven by ${session.driver ?? "nobody"}` : "ended"}
            {session.group ? ` · ${session.group}` : ""} · updated {timeAgo(session.updatedAt)}
          </span>
        </span>
        <ArrowRightIcon className="size-4 shrink-0 text-zinc-600 transition group-hover:text-zinc-300" />
      </Link>
    </li>
  );
}

function SessionList({ sessions }: { sessions: LiveSessionSummary[] }) {
  return (
    <Card>
      <ul className="divide-y divide-white/5">
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </ul>
    </Card>
  );
}

export function SessionsPanel({ agent }: { agent: OwnedAgent }) {
  const { data, mutate } = useApi<{ sessions: LiveSessionSummary[] }>(
    agentPath(agent.handle, "/sessions"),
  );
  useSessionEvents(() => void mutate());

  if (!data) {
    return (
      <div className="flex justify-center p-10 text-zinc-500">
        <Spinner />
      </div>
    );
  }
  if (data.sessions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-white">No live sessions yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Ask {agent.handle} to start a live session for a longer task, and share it with a #group
          if your team should follow along. You&apos;ll watch every step here and can correct it
          while it works.
        </p>
      </Card>
    );
  }
  return <SessionList sessions={data.sessions} />;
}

// Sessions running right now, across every agent the owner can watch through.
export function LiveNow() {
  const { data, mutate } = useApi<{ sessions: LiveSessionSummary[] }>("/v1/sessions");
  useSessionEvents(() => void mutate());
  const live = data?.sessions.filter((session) => session.status === "live") ?? [];
  if (live.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-medium text-zinc-300">Live now</h2>
      <SessionList sessions={live} />
    </section>
  );
}

const KIND_LABEL: Record<LiveSessionEvent["kind"], string> = {
  step: "Step",
  tool: "Tool",
  diff: "Diff",
  note: "Note",
  steer: "Correction",
  handoff: "Handoff",
  status: "",
};

function EventRow({ event }: { event: LiveSessionEvent }) {
  if (event.kind === "status") {
    return (
      <li className="flex items-center gap-3 py-1 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-white/5" />
        <span title={fullDate(event.at)}>{event.text}</span>
        <span className="h-px flex-1 bg-white/5" />
      </li>
    );
  }
  if (event.kind === "steer") {
    return (
      <li className="rounded-xl border border-signal/30 bg-signal/[0.06] px-4 py-3">
        <p className="text-xs text-orange-200/80" title={fullDate(event.at)}>
          Correction from the person behind {event.by ?? "a member"} · {timeAgo(event.at)}
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-white">{event.text}</p>
      </li>
    );
  }
  if (event.kind === "handoff") {
    return (
      <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-xs text-zinc-500" title={fullDate(event.at)}>
          Handoff from {event.by ?? "the agent"} · {timeAgo(event.at)}
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-100">{event.text}</p>
      </li>
    );
  }
  const code = event.kind === "tool" || event.kind === "diff";
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 py-1.5 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
      <span className="pt-0.5 font-mono text-[11px] text-zinc-600" title={fullDate(event.at)}>
        #{event.seq}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] tracking-wide text-zinc-500 uppercase">
          {KIND_LABEL[event.kind]}
          {event.by ? <span className="normal-case"> · {event.by}</span> : null}
        </p>
        <p
          className={
            code
              ? "mt-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 font-mono text-xs whitespace-pre text-zinc-300"
              : `mt-0.5 text-sm whitespace-pre-wrap ${event.kind === "note" ? "text-zinc-400" : "text-zinc-100"}`
          }
        >
          {event.text}
        </p>
      </div>
    </li>
  );
}

function nearBottom() {
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;
}

function Composer({
  session,
  onSent,
}: {
  session: LiveSession;
  onSent: (session: LiveSession) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.status === "ended") {
    return (
      <p className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-500">
        This session has ended.
      </p>
    );
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { session: updated } = await api<{ session: LiveSession }>(
        `/v1/sessions/${session.id}/steer`,
        { method: "POST", body: { text: text.trim() } },
      );
      setText("");
      onSent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the correction.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void send(event)}
      className="grid gap-2 rounded-2xl border border-white/10 bg-zinc-950/90 p-3 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <Textarea
        value={text}
        maxLength={2000}
        rows={2}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send(event);
        }}
        placeholder={`Correct ${session.driver ?? "the agent"}, like "keep the phone column for now"`}
        className="min-h-14 resize-none border-0 bg-transparent px-1 focus:border-0"
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          Reaches {session.driver ?? "the agent"} on its next step, marked as coming from you.
        </span>
        <Button size="sm" loading={sending} disabled={!text.trim()} type="submit">
          Send
        </Button>
      </div>
    </form>
  );
}

export function LiveSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, mutate } = useApi<{ session: LiveSession; through: string }>(
    `/v1/sessions/${id}`,
  );
  const session = data?.session;
  const end = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

  useEffect(() => {
    if (follow.current) end.current?.scrollIntoView({ block: "end" });
  }, [session?.lastSeq]);

  useSessionEvents((change) => {
    if (change.session !== id || !data) return;
    follow.current = nearBottom();
    void api<{ session: LiveSession }>(`/v1/sessions/${id}?after=${data.session.lastSeq}`).then(
      ({ session: fresh }) =>
        mutate(
          (current) => {
            if (!current) return current;
            const known = new Set(current.session.events.map((event) => event.seq));
            return {
              ...current,
              session: {
                ...fresh,
                events: [
                  ...current.session.events,
                  ...fresh.events.filter((event) => !known.has(event.seq)),
                ],
              },
            };
          },
          { revalidate: false },
        ),
    );
  });

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-white">You can&apos;t see this session</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Live sessions are visible to their owner and to the members of the #group they&apos;re
          shared with. Ask whoever sent you the link to add one of your agents to that group.
        </p>
      </Card>
    );
  }
  if (!session || !data) {
    return (
      <div className="flex justify-center p-10 text-zinc-500">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{session.title}</h1>
          <LiveBadge status={session.status} />
        </div>
        <p className="text-sm text-zinc-500">
          {session.status === "live" ? (
            <>
              Driven by <span className="text-zinc-300">{session.driver ?? "nobody"}</span>
            </>
          ) : (
            <>Ended {session.endedAt ? timeAgo(session.endedAt) : ""}</>
          )}
          {session.client ? ` · ${session.client}` : ""}
          {" · "}
          {session.group ? (
            <>
              shared with <span className="text-zinc-300">{session.group}</span>
            </>
          ) : (
            "only its owner can see it"
          )}
          {" · "}
          <span title={fullDate(session.startedAt)}>started {timeAgo(session.startedAt)}</span>
        </p>
        <p className="text-xs text-zinc-600">You&apos;re watching through {data.through}.</p>
      </header>

      <ol className="grid gap-2">
        {session.events.map((event) => (
          <EventRow key={event.seq} event={event} />
        ))}
      </ol>
      <div ref={end} className="scroll-mb-48" />

      <div className="sticky bottom-4 z-10">
        <Composer
          session={session}
          onSent={(updated) => {
            follow.current = true;
            void mutate({ ...data, session: updated }, { revalidate: false });
          }}
        />
      </div>
    </div>
  );
}
