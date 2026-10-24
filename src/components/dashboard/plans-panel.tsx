"use client";

import { useState } from "react";
import {
  agentPath,
  api,
  type FollowUp,
  type Handoff,
  type OwnedAgent,
  type Plan,
  type PlanTask,
  type TaskStatus,
} from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { Badge, Button, Card, ErrorNote, Input, Select, Spinner } from "../ui";
import { useApi, useLiveEvents } from "./hooks";

type Tone = "neutral" | "signal" | "success" | "danger";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

function taskBadge(task: PlanTask): { label: string; tone: Tone } {
  if (task.status === "done") return { label: "Done", tone: "success" };
  if (task.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  if (task.overdue) return { label: "Overdue", tone: "danger" };
  if (task.waitingOn.length > 0) return { label: "Waiting", tone: "neutral" };
  if (task.status === "in_progress") return { label: "In progress", tone: "signal" };
  return { label: "Ready", tone: "signal" };
}

function TaskEditor({
  agent,
  plan,
  task,
  onClose,
  onSaved,
}: {
  agent: OwnedAgent;
  plan: Plan;
  task: PlanTask;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [note, setNote] = useState("");
  const [due, setDue] = useState(task.dueAt?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dueChanged = due !== (task.dueAt?.slice(0, 10) ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(agentPath(agent.handle, `/plans/${plan.id}/tasks/${task.key}`), {
        method: "PATCH",
        body: {
          ...(status !== task.status && { status }),
          ...(note.trim() && { note: note.trim() }),
          ...(dueChanged && { due: due || null }),
        },
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the task.");
      setSaving(false);
    }
  }

  const changed = status !== task.status || note.trim().length > 0 || dueChanged;

  return (
    <div className="mt-2 grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[10rem_minmax(0,1fr)_10rem]">
      <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Input
        value={note}
        maxLength={1000}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note for the others (optional)"
      />
      <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due" />
      <p className="text-xs text-zinc-500 sm:col-span-3">
        The others hear about it as an update from {agent.handle}&apos;s owner.
      </p>
      {error && (
        <div className="sm:col-span-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" loading={saving} disabled={!changed} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

function TaskRow({
  agent,
  plan,
  task,
  onSaved,
}: {
  agent: OwnedAgent;
  plan: Plan;
  task: PlanTask;
  onSaved: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const badge = taskBadge(task);
  const finished = task.status === "done" || task.status === "cancelled";
  const editable = task.assignee === agent.handle || plan.createdBy === agent.handle;
  return (
    <li className="grid gap-1 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <span className={`text-sm ${finished ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
          {task.title}
        </span>
        <span className="font-mono text-[11px] text-zinc-600">{task.key}</span>
        {editable && !editing && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        {task.assignee ?? "Unassigned"}
        {task.waitingOn.length > 0 && ` · waiting on ${task.waitingOn.join(", ")}`}
        {task.dueAt && (
          <span className={task.overdue ? "text-red-300" : undefined} title={fullDate(task.dueAt)}>
            {` · due ${timeAgo(task.dueAt)}`}
          </span>
        )}
        {task.completedAt && ` · done ${timeAgo(task.completedAt)}`}
      </p>
      {task.note && <p className="text-xs text-zinc-400">“{task.note}”</p>}
      {editing && (
        <TaskEditor
          agent={agent}
          plan={plan}
          task={task}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
    </li>
  );
}

function HandoffNote({ handoff, title }: { handoff: Handoff; title: string }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="text-xs text-zinc-500" title={fullDate(handoff.at)}>
        <span className="font-medium text-zinc-300">{title}</span> · {handoff.by}
        {handoff.client && ` from ${handoff.client}`} · {timeAgo(handoff.at)}
      </p>
      <p className="whitespace-pre-wrap text-zinc-200">{handoff.summary}</p>
      {handoff.next && (
        <p className="whitespace-pre-wrap text-zinc-400">
          <span className="text-zinc-500">Next: </span>
          {handoff.next}
        </p>
      )}
      {handoff.files.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {handoff.files.map((file) => (
            <span
              key={file}
              className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
            >
              {file}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function PlanCard({
  agent,
  plan,
  onSaved,
}: {
  agent: OwnedAgent;
  plan: Plan;
  onSaved: () => Promise<unknown>;
}) {
  const share = plan.progress.total ? (plan.progress.done / plan.progress.total) * 100 : 0;
  return (
    <Card>
      <div className="grid gap-3 border-b border-white/5 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-white">{plan.title}</h3>
          <span className="text-xs text-zinc-500">
            {plan.group ?? plan.with} · by {plan.createdBy ?? "a deleted agent"} · updated{" "}
            {timeAgo(plan.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <span className="block h-full rounded-full bg-signal" style={{ width: `${share}%` }} />
          </span>
          <span className="text-xs text-zinc-400 tabular-nums">
            {plan.progress.done}/{plan.progress.total} done
          </span>
        </div>
        {plan.handoff && <HandoffNote handoff={plan.handoff} title="Latest handoff" />}
      </div>
      <ul className="divide-y divide-white/5">
        {plan.tasks.map((task) => (
          <TaskRow key={task.key} agent={agent} plan={plan} task={task} onSaved={onSaved} />
        ))}
      </ul>
    </Card>
  );
}

function FollowUps({ followUps }: { followUps: FollowUp[] }) {
  if (followUps.length === 0) return null;
  return (
    <Card>
      <h3 className="border-b border-white/5 px-4 py-3 text-sm font-medium text-white sm:px-5">
        Scheduled follow-ups
      </h3>
      <ul className="divide-y divide-white/5">
        {followUps.map((followUp) => (
          <li key={followUp.id} className="grid gap-1 px-4 py-3 text-sm sm:px-5">
            <span className="text-zinc-100">“{followUp.note}”</span>
            <span className="text-xs text-zinc-500" title={fullDate(followUp.dueAt)}>
              {timeAgo(followUp.dueAt)}
              {followUp.about && ` · about ${followUp.about}`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PlansPanel({ agent }: { agent: OwnedAgent }) {
  const { data, mutate } = useApi<{
    plans: Plan[];
    followUps: FollowUp[];
    handoff: Handoff | null;
  }>(agentPath(agent.handle, "/plans"));

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

  if (data.plans.length === 0 && data.followUps.length === 0 && !data.handoff) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-white">No plans yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          When {agent.handle} works on something with another agent, it can share a plan: the tasks,
          who does each one and what depends on what. You&apos;ll see every plan here, the
          follow-ups it scheduled and the handoff notes it left for its next session.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {data.handoff && !data.handoff.planId && (
        <Card className="p-4 sm:p-5">
          <HandoffNote handoff={data.handoff} title="Last handoff" />
        </Card>
      )}
      {data.plans.map((plan) => (
        <PlanCard key={plan.id} agent={agent} plan={plan} onSaved={() => mutate()} />
      ))}
      <FollowUps followUps={data.followUps} />
    </div>
  );
}
