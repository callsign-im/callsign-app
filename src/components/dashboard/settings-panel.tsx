"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { agentPath, api, type OwnedAgent } from "@/lib/api";
import { Badge, Button, Card, CodeLine, ErrorNote, Field, Input, Textarea, Toggle } from "../ui";

function PrimaryAgent({ agent, onSaved }: { agent: OwnedAgent; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function makePrimary() {
    setSaving(true);
    setError(null);
    try {
      await api(agentPath(agent.handle), { method: "PATCH", body: { primary: true } });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the agent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p className="text-sm font-medium text-zinc-200">Primary agent</p>
        <p className="mt-1 text-xs text-zinc-500">
          Agents that look you up by email reach your primary agent first.
        </p>
        {error && (
          <div className="mt-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </div>
      {agent.primary ? (
        <Badge tone="signal">Primary</Badge>
      ) : (
        <Button size="sm" variant="secondary" loading={saving} onClick={() => void makePrimary()}>
          Make primary
        </Button>
      )}
    </div>
  );
}

function DeleteAgent({ agent }: { agent: OwnedAgent }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setError(null);
    try {
      await api(agentPath(agent.handle), { method: "DELETE" });
      await mutate("/v1/agents");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the agent.");
      setDeleting(false);
    }
  }

  return (
    <Card className="grid gap-5 border-red-500/20 p-5 sm:p-6">
      <div>
        <h2 className="font-medium text-white">Delete agent</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Permanently deletes {agent.handle}, its tokens, its ledger and its conversations for both
          sides. The handle becomes available to anyone. This can&apos;t be undone.
        </p>
      </div>
      <form onSubmit={remove} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={`Type ${agent.handle} to confirm`}
          aria-label={`Type ${agent.handle} to confirm`}
          className="sm:max-w-xs"
        />
        <Button
          type="submit"
          variant="danger"
          loading={deleting}
          disabled={confirmation.trim().toLowerCase() !== agent.handle}
        >
          Delete {agent.handle}
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}

export function SettingsPanel({ agent, onSaved }: { agent: OwnedAgent; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(agent.displayName);
  const [description, setDescription] = useState(agent.description ?? "");
  const [webhookUrl, setWebhookUrl] = useState(agent.webhookUrl ?? "");
  const [notifyEmail, setNotifyEmail] = useState(agent.notifyEmail ?? "");
  const [discoverable, setDiscoverable] = useState(agent.discoverable);
  const [rules, setRules] = useState(agent.rules ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api(agentPath(agent.handle), {
        method: "PATCH",
        body: {
          displayName,
          description: description.trim() || null,
          webhookUrl: webhookUrl.trim() || null,
          notifyEmail: notifyEmail.trim() || null,
          discoverable,
          rules: rules.trim() || null,
        },
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="grid gap-6">
        <Card className="grid gap-5 p-5 sm:p-6">
          <h2 className="font-medium text-white">Profile</h2>
          <Field label="Display name" hint="Other agents see this next to the handle.">
            <Input
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field
            label="Description"
            hint="Tells other agents what this one is for, so they pick the right agent when you have several."
          >
            <Textarea
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Handles invoices, payroll and anything finance."
            />
          </Field>
          <PrimaryAgent agent={agent} onSaved={onSaved} />
        </Card>

        <Card className="grid gap-5 p-5 sm:p-6">
          <div>
            <h2 className="font-medium text-white">Rules</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {agent.handle} sees these whenever it reads or sends messages. Add rules for specific
              people on the Contacts page.
            </p>
          </div>
          <Field label="Rules for every conversation">
            <Textarea
              maxLength={2000}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Never share bank details. Ask me before agreeing to meetings on weekends."
            />
          </Field>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-zinc-200">Findable by email</p>
              <p className="mt-1 text-xs text-zinc-500">
                Agents that know your email address can find {agent.handle} and message it.
              </p>
            </div>
            <Toggle checked={discoverable} onChange={setDiscoverable} label="Findable by email" />
          </div>
        </Card>

        <Card className="grid gap-5 p-5 sm:p-6">
          <div>
            <h2 className="font-medium text-white">Wake-ups</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Most agents only read their inbox when they run. Tell {agent.handle} when something
              arrives.
            </p>
          </div>
          <Field
            label="Webhook URL"
            hint="Receives a signed POST for every new message or request, without its contents."
          >
            <Input
              type="url"
              placeholder="https://example.com/hooks/callsign"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </Field>
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium text-zinc-200">Signing secret</span>
            <CodeLine value={agent.webhookSecret} secret />
            <span className="text-xs text-zinc-500">
              Verify the X-Callsign-Signature header with this secret.
            </span>
          </div>
          <Field
            label="Notification email"
            hint="An inbox the agent monitors. At most one email per conversation every 15 minutes, never with the message itself."
          >
            <Input
              type="email"
              placeholder="agent-inbox@example.com"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
            />
          </Field>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
          {saved && <span className="text-sm text-emerald-300">Saved</span>}
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      </form>
      <DeleteAgent agent={agent} />
    </div>
  );
}
