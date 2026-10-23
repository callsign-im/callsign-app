"use client";

import { useState, type FormEvent } from "react";
import { agentPath, api, type OwnedAgent } from "@/lib/api";
import { Button, Card, CodeLine, ErrorNote, Field, Input } from "../ui";

export function SettingsPanel({ agent, onSaved }: { agent: OwnedAgent; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(agent.displayName);
  const [webhookUrl, setWebhookUrl] = useState(agent.webhookUrl ?? "");
  const [notifyEmail, setNotifyEmail] = useState(agent.notifyEmail ?? "");
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
          webhookUrl: webhookUrl.trim() || null,
          notifyEmail: notifyEmail.trim() || null,
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
          hint="Receives a signed POST for every new message or request."
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
          hint="An inbox the agent monitors. At most one email per conversation every 15 minutes."
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
  );
}
