"use client";

import { useState, type FormEvent } from "react";
import { api, type Contact } from "@/lib/api";
import { productInfo } from "@/lib/products";
import { PlusIcon } from "../icons";
import { ProductAvatar } from "../product-avatar";
import { Button, Card, ErrorNote, Field, Input, Spinner, Textarea } from "../ui";
import { useApi } from "./hooks";

type Draft = { handle: string; name: string; notes: string; rules: string };

const EMPTY: Draft = { handle: "", name: "", notes: "", rules: "" };

function ContactForm({
  initial,
  editing,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  editing: boolean;
  onSubmit: (draft: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the contact.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <Field label="Agent handle">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-zinc-500">
            @
          </span>
          <Input
            required
            disabled={editing}
            value={draft.handle}
            onChange={(e) => set("handle")(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="mateorivasagent"
            className="pl-7 font-mono"
          />
        </div>
      </Field>
      <Field label="Name" hint="How your agents should refer to them.">
        <Input
          required
          maxLength={80}
          value={draft.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="Mateo (co-founder)"
        />
      </Field>
      <Field label="Notes" hint="Optional context, e.g. what you work on together.">
        <Textarea
          maxLength={500}
          value={draft.notes}
          onChange={(e) => set("notes")(e.target.value)}
          placeholder="Handles finance and infrastructure."
        />
      </Field>
      <Field label="Rules" hint="Your agents see these whenever they talk to this contact.">
        <Textarea
          maxLength={2000}
          value={draft.rules}
          onChange={(e) => set("rules")(e.target.value)}
          placeholder="Share invoices and calendars freely. Never agree to spend more than $500."
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={saving}>
          {editing ? "Save changes" : "Add contact"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </form>
  );
}

function ContactRow({
  contact,
  onChanged,
}: {
  contact: Contact;
  onChanged: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (editing) {
    return (
      <li className="px-4 py-5 sm:px-5">
        <ContactForm
          editing
          initial={{
            handle: contact.agent.handle.slice(1),
            name: contact.name,
            notes: contact.notes ?? "",
            rules: contact.rules ?? "",
          }}
          onCancel={() => setEditing(false)}
          onSubmit={async (draft) => {
            await api(`/v1/contacts/${contact.id}`, {
              method: "PATCH",
              body: { name: draft.name, notes: draft.notes || null, rules: draft.rules || null },
            });
            await onChanged();
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start gap-4 px-4 py-4 sm:flex-nowrap sm:px-5">
      <ProductAvatar product={contact.agent.product} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white">{contact.name}</p>
        <p className="text-sm text-zinc-500">
          {contact.agent.handle} · {productInfo(contact.agent.product).label}
        </p>
        {contact.notes && <p className="mt-2 text-sm text-zinc-400">{contact.notes}</p>}
        {contact.rules && (
          <p className="mt-2 rounded-lg border border-signal/20 bg-signal/[0.05] px-3 py-2 text-sm text-orange-100">
            <span className="text-orange-300">Rules:</span> {contact.rules}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {confirming ? (
          <>
            <Button
              size="sm"
              variant="danger"
              loading={removing}
              onClick={() => {
                setRemoving(true);
                void api(`/v1/contacts/${contact.id}`, { method: "DELETE" })
                  .then(onChanged)
                  .finally(() => setRemoving(false));
              }}
            >
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function ContactsPage() {
  const { data, mutate } = useApi<{ contacts: Contact[] }>("/v1/contacts");
  const [adding, setAdding] = useState(false);
  const contacts = data?.contacts;
  const showForm = adding || contacts?.length === 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Contacts</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            The people and agents you work with. Your agents find them by name and follow the
            rules you set for each one.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" /> New contact
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="animate-fade-up p-5 sm:p-6">
          <ContactForm
            editing={false}
            initial={EMPTY}
            onCancel={() => setAdding(false)}
            onSubmit={async (draft) => {
              await api("/v1/contacts", {
                method: "POST",
                body: {
                  handle: draft.handle,
                  name: draft.name,
                  notes: draft.notes || null,
                  rules: draft.rules || null,
                },
              });
              await mutate();
              setAdding(false);
            }}
          />
        </Card>
      )}

      {!contacts ? (
        <div className="flex justify-center p-10 text-zinc-500">
          <Spinner />
        </div>
      ) : (
        contacts.length > 0 && (
          <Card>
            <ul className="divide-y divide-white/5">
              {contacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} onChanged={() => mutate()} />
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  );
}
