"use client";

import { useState, type FormEvent } from "react";
import { api, type Passkey, type PasskeyReset } from "@/lib/api";
import { fullDate, timeAgo } from "@/lib/format";
import { addPasskey, passkeyError } from "@/lib/passkeys";
import { Badge, Button, Card, ErrorNote, Input } from "../ui";
import { useApi } from "./hooks";

type PasskeysView = {
  passkeys: Passkey[];
  reset: PasskeyReset | null;
  elevatedUntil: string | null;
};

function failure(err: unknown, fallback: string): string | null {
  if (err instanceof Error && "code" in err && err.code === "step_up_cancelled") return null;
  return passkeyError(err, fallback);
}

function PasskeyRow({
  passkey,
  onRemoved,
}: {
  passkey: Passkey;
  onRemoved: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/me/passkeys/${passkey.id}`, { method: "DELETE" });
      await onRemoved();
    } catch (err) {
      setError(failure(err, "Couldn't remove the passkey."));
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-4">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-zinc-100">{passkey.name}</span>
            {passkey.backedUp && <Badge>Synced</Badge>}
          </span>
          <span className="block text-xs text-zinc-500">
            Added {timeAgo(passkey.createdAt)}
            {passkey.lastUsedAt && ` · used ${timeAgo(passkey.lastUsedAt)}`}
          </span>
        </span>
        {confirming ? (
          <span className="flex gap-2">
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
              Remove
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Remove
          </Button>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </li>
  );
}

function LostPasskeys({
  reset,
  onChange,
}: {
  reset: PasskeyReset | null;
  onChange: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string) {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: "POST" });
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (reset) {
    return (
      <div className="grid gap-3 border-t border-white/5 px-4 py-4 sm:px-5">
        <p className="text-sm text-orange-200">
          Every passkey will be removed on {fullDate(reset.runAt)}. If you didn&apos;t ask for this,
          cancel it: someone may have access to your email.
        </p>
        <div>
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => void run("/v1/me/passkeys/reset/cancel")}
          >
            Cancel the removal
          </Button>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    );
  }

  return (
    <div className="grid gap-3 border-t border-white/5 px-4 py-4 sm:px-5">
      {open ? (
        <>
          <p className="text-sm text-zinc-400">
            If you can&apos;t use any of them, Callsign removes them all 72 hours after you ask. You
            get an email and a Telegram message right away, so you can cancel if it wasn&apos;t you.
            It only works within 15 minutes of signing in with an email link.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              onClick={() => void run("/v1/me/passkeys/reset")}
            >
              Remove them in 72 hours
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Never mind
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="justify-self-start text-sm text-zinc-500 underline decoration-white/20 underline-offset-4 transition hover:text-white"
        >
          Lost your passkeys?
        </button>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

export function PasskeysCard() {
  const { data, mutate } = useApi<PasskeysView>("/v1/me/passkeys");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passkeys = data?.passkeys ?? [];

  async function add(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await addPasskey(name.trim() || undefined);
      setName("");
      await mutate();
    } catch (err) {
      setError(failure(err, "Couldn't add the passkey."));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card>
      <div className="p-5 sm:p-6">
        <h2 className="font-medium text-white">Passkeys</h2>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          {passkeys.length > 0
            ? "Callsign asks for one before sensitive changes: creating tokens, connecting apps, unfreezing an agent, changing where it's woken up or its rules, and deleting things. A stolen session can't make them without it."
            : "Add one and Callsign asks for it before sensitive changes, like creating tokens, connecting apps or unfreezing an agent. Without it, anyone holding your signed-in session can make them."}
        </p>
        <form onSubmit={add} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MacBook, iPhone, security key…"
            aria-label="Passkey name"
            maxLength={60}
            className="sm:max-w-xs"
          />
          <Button
            type="submit"
            variant={passkeys.length > 0 ? "secondary" : "primary"}
            loading={adding}
          >
            Add a passkey
          </Button>
        </form>
        {error && (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </div>
      {passkeys.length > 0 && (
        <>
          <ul className="divide-y divide-white/5 border-t border-white/5">
            {passkeys.map((passkey) => (
              <PasskeyRow key={passkey.id} passkey={passkey} onRemoved={() => mutate()} />
            ))}
          </ul>
          <LostPasskeys reset={data?.reset ?? null} onChange={() => mutate()} />
        </>
      )}
    </Card>
  );
}
