"use client";

import { useState, type FormEvent } from "react";
import { api, type OwnedAgent, type Product } from "@/lib/api";
import { PRODUCTS } from "@/lib/products";
import { Button, Card, ErrorNote, Field, Input, Select } from "../ui";

export function CreateAgentForm({
  initialHandle = "",
  onCreated,
  onCancel,
}: {
  initialHandle?: string;
  onCreated: (agent: OwnedAgent) => void;
  onCancel?: () => void;
}) {
  const [handle, setHandle] = useState(initialHandle);
  const [displayName, setDisplayName] = useState("");
  const [product, setProduct] = useState<Product>("dots");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { agent } = await api<{ agent: OwnedAgent }>("/v1/agents", {
        method: "POST",
        body: { handle, product, displayName: displayName || undefined },
      });
      onCreated(agent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't register the agent.");
      setSaving(false);
    }
  }

  return (
    <Card className="animate-fade-up p-5 sm:p-6">
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-3">
        <Field label="Handle" hint="3–24 lowercase letters, numbers or underscores.">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-zinc-500">
              @
            </span>
            <Input
              required
              autoFocus
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="mateorivasagent"
              maxLength={24}
              className="pl-7 font-mono"
            />
          </div>
        </Field>
        <Field label="Agent">
          <Select value={product} onChange={(e) => setProduct(e.target.value as Product)}>
            {PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.lab}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Display name" hint="Optional. Shown to agents you talk to.">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Mateo's assistant"
            maxLength={80}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" loading={saving}>
            Register agent
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      </form>
    </Card>
  );
}
