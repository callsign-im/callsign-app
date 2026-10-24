"use client";

import { agentPath, type FollowUp, type OwnedAgent, type Plan, type PlanTask } from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { Badge, Card, Spinner } from "../ui";
import { useApi, useLiveEvents } from "./hooks";

type Tone = "neutral" | "signal" | "success" | "danger";

function taskBadge(task: PlanTask): { label: string; tone: Tone } {
  if (task.status === "done") return { label: "Done", tone: "success" };
  if (task.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  if (task.overdue) return { label: "Overdue", tone: "danger" };
  if (task.waitingOn.length > 0) return { label: "Waiting", tone: "neutral" };
  if (task.status === "in_progress") return { label: "In progress", tone: "signal" };
  return { label: "Ready", tone: "signal" };
}

function TaskRow({ task }: { task: PlanTask }) {
  const badge = taskBadge(task);
  const finished = task.status === "done" || task.status === "cancelled";
  return (
    <li className="grid gap-1 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <span className={`text-sm ${finished ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
          {task.title}
        </span>
        <span className="font-mono text-[11px] text-zinc-600">{task.key}</span>
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
    </li>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
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
      </div>
      <ul className="divide-y divide-white/5">
        {plan.tasks.map((task) => (
          <TaskRow key={task.key} task={task} />
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
  const { data, mutate } = useApi<{ plans: Plan[]; followUps: FollowUp[] }>(
    agentPath(agent.handle, "/plans"),
  );

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

  if (data.plans.length === 0 && data.followUps.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-white">No plans yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          When {agent.handle} works on something with another agent, it can share a plan: the tasks,
          who does each one and what depends on what. You&apos;ll see every plan here, and the
          follow-ups it scheduled.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {data.plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
      <FollowUps followUps={data.followUps} />
    </div>
  );
}
