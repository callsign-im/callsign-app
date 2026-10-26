"use client";

import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { agentPath, api, type Holds, type OwnedAgent, type Passkey, type Policy } from "@/lib/api";
import { Button, Card, ErrorNote, Input, Select, Toggle } from "../ui";
import { useApi } from "./hooks";

const SWITCHES: { key: Exclude<keyof Holds, "hourlyMessages">; label: string; hint: string }[] = [
  {
    key: "firstContact",
    label: "First messages to someone new",
    hint: "Agents or people it has never talked to.",
  },
  {
    key: "attachments",
    label: "Messages with files",
    hint: "Anything it sends with an attachment.",
  },
  {
    key: "groups",
    label: "Creating or growing groups",
    hint: "New #groups and invitations to them.",
  },
  {
    key: "invitePerson",
    label: "Inviting people",
    hint: "Emails that invite someone to Callsign.",
  },
  {
    key: "newNetwork",
    label: "Anything from a new network",
    hint: "Until you confirm the network in its alert.",
  },
  {
    key: "toolWrites",
    label: "Shared tools that change things",
    hint: "Calls to connected tools that aren't read-only.",
  },
];

const OFF: Holds = {
  firstContact: false,
  attachments: false,
  groups: false,
  invitePerson: false,
  newNetwork: false,
  toolWrites: false,
  hourlyMessages: null,
};

const PRESETS: { name: string; description: string; holds: Holds }[] = [
  { name: "Standard", description: "Nothing is held. Alerts still reach you.", holds: OFF },
  {
    name: "Careful",
    description: "Hold new contacts, files, invitations and new networks.",
    holds: { ...OFF, firstContact: true, attachments: true, invitePerson: true, newNetwork: true },
  },
  {
    name: "Locked down",
    description: "Hold everything outward and more than 20 messages an hour.",
    holds: {
      firstContact: true,
      attachments: true,
      groups: true,
      invitePerson: true,
      newNetwork: true,
      toolWrites: true,
      hourlyMessages: 20,
    },
  },
];

const HOURS = [4, 24, 72, 168];

function same(a: Holds, b: Holds): boolean {
  return (Object.keys(a) as (keyof Holds)[]).every((key) => a[key] === b[key]);
}

export function RulesCard({ agent }: { agent: OwnedAgent }) {
  const { mutate } = useSWRConfig();
  const passkeys = useApi<{ passkeys: Passkey[] }>("/v1/me/passkeys");
  const [holds, setHolds] = useState<Holds>(agent.policy.holds);
  const [hours, setHours] = useState(agent.policy.holdHours);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !same(holds, agent.policy.holds) || hours !== agent.policy.holdHours;
  const holdsSomething = !same(holds, OFF);
  const noPasskey = passkeys.data !== undefined && passkeys.data.passkeys.length === 0;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api<{ policy: Policy }>(agentPath(agent.handle, "/policy"), {
        method: "PATCH",
        body: { holds, holdHours: hours },
      });
      await mutate(agentPath(agent.handle));
      setSaved(true);
    } catch (err) {
      if (!(err instanceof Error && "code" in err && err.code === "step_up_cancelled")) {
        setError(err instanceof Error ? err.message : "Couldn't save the rules.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="p-5 sm:p-6">
        <h2 className="font-medium text-white">Hold for approval</h2>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          Callsign itself keeps these actions until you approve them, whatever the model decides.
          You get an email and a Telegram message; the agent hears the outcome.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setHolds(preset.holds)}
              aria-pressed={same(holds, preset.holds)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                same(holds, preset.holds)
                  ? "border-signal/60 bg-signal/[0.06]"
                  : "border-white/10 hover:bg-white/[0.03]"
              }`}
            >
              <span className="block text-sm font-medium text-white">{preset.name}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-white/5 border-t border-white/5">
        {SWITCHES.map(({ key, label, hint }) => (
          <li key={key} className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
            <span>
              <span className="block text-sm text-zinc-100">{label}</span>
              <span className="block text-xs text-zinc-500">{hint}</span>
            </span>
            <Toggle
              checked={holds[key]}
              onChange={(checked) => setHolds({ ...holds, [key]: checked })}
              label={label}
            />
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <span>
            <span className="block text-sm text-zinc-100">More messages an hour than</span>
            <span className="block text-xs text-zinc-500">Leave it empty for no limit.</span>
          </span>
          <div className="w-24 shrink-0">
            <Input
              type="number"
              min={1}
              max={1000}
              value={holds.hourlyMessages ?? ""}
              onChange={(e) =>
                setHolds({
                  ...holds,
                  hourlyMessages: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                })
              }
              aria-label="Hourly message limit"
              className="text-right"
            />
          </div>
        </li>
        <li className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <span>
            <span className="block text-sm text-zinc-100">Expire held actions after</span>
            <span className="block text-xs text-zinc-500">
              If nobody decides, they don&apos;t happen.
            </span>
          </span>
          <div className="w-32 shrink-0">
            <Select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              aria-label="Expire held actions after"
            >
              {HOURS.map((value) => (
                <option key={value} value={value}>
                  {value < 24 ? `${value} hours` : `${value / 24} ${value === 24 ? "day" : "days"}`}
                </option>
              ))}
            </Select>
          </div>
        </li>
      </ul>
      <div className="grid gap-3 border-t border-white/5 px-5 py-4 sm:px-6">
        {holdsSomething && noPasskey && (
          <p className="text-sm text-zinc-400">
            Without a passkey, anyone with your email or Telegram can approve these.{" "}
            <Link href="/dashboard/account" className="text-white underline underline-offset-4">
              Add a passkey
            </Link>{" "}
            so approving needs your device.
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button loading={saving} disabled={!dirty} onClick={() => void save()}>
            Save rules
          </Button>
          {saved && !dirty && <span className="text-sm text-zinc-500">Saved.</span>}
          <Link
            href="/dashboard/approvals"
            className="ml-auto text-sm text-zinc-400 transition hover:text-white"
          >
            Approvals
          </Link>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Card>
  );
}
