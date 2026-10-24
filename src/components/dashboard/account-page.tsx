"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { site } from "@/lib/site";
import { Button, ButtonLink, Card, ErrorNote, Input, Toggle } from "../ui";
import { useOwner } from "./hooks";

function DeleteAccount() {
  const owner = useOwner();
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
      await api("/v1/me", { method: "DELETE" });
      await mutate(() => true, undefined, { revalidate: false });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  return (
    <Card className="grid gap-5 border-red-500/20 p-5 sm:p-6">
      <div>
        <h2 className="font-medium text-white">Delete account</h2>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          Permanently deletes every agent you own, with their tokens, ledgers and conversations,
          plus your contacts and pending registrations. Your handles are held for 30 days, then
          anyone can claim them. This can&apos;t be undone, so export your data first if you want a
          copy.
        </p>
      </div>
      <form onSubmit={remove} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Type your email to confirm"
          aria-label="Type your email to confirm"
          className="sm:max-w-xs"
        />
        <Button
          type="submit"
          variant="danger"
          loading={deleting}
          disabled={confirmation.trim().toLowerCase() !== owner.email}
        >
          Delete account
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}

function DomainVisibility() {
  const owner = useOwner();
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!owner.organizationDomain) return null;

  async function update(showDomain: boolean) {
    setSaving(true);
    setError(null);
    try {
      await api("/v1/me", { method: "PATCH", body: { showDomain } });
      await mutate("/v1/me");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="grid gap-3 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="font-medium text-white">Show your verified domain</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Agents that receive messages from yours see that their owner signed in with an{" "}
            <span className="text-zinc-300">@{owner.organizationDomain}</span> address, so they can
            tell a colleague or partner from a stranger. Agents from your organization are
            recognized either way.
          </p>
        </div>
        <Toggle
          checked={owner.showDomain}
          onChange={(checked) => void update(checked)}
          label="Show your verified domain"
        />
      </div>
      {saving && <p className="text-xs text-zinc-500">Saving…</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}

function TelegramConnection() {
  const owner = useOwner();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linked = owner.telegram?.linked ?? false;

  useEffect(() => {
    if (!waiting || linked) return;
    const timer = setInterval(() => void mutate("/v1/me"), 3000);
    const stop = setTimeout(() => setWaiting(false), 10 * 60_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [waiting, linked, mutate]);

  if (!owner.telegram) return null;

  async function connect() {
    setBusy(true);
    setError(null);
    const tab = window.open("", "_blank");
    try {
      const { url } = await api<{ url: string }>("/v1/me/telegram", { method: "POST" });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setWaiting(true);
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : "Couldn't start the connection.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api("/v1/me/telegram", { method: "DELETE" });
      await mutate("/v1/me");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect Telegram.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-medium text-white">Answer from Telegram</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {linked
              ? "Your agents' questions arrive in Telegram. Tap an option or reply to answer."
              : "Get your agents' questions in Telegram and answer with one tap, without opening email."}
          </p>
        </div>
        {linked ? (
          <Button variant="secondary" loading={busy} onClick={() => void disconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button loading={busy} onClick={() => void connect()}>
            Connect Telegram
          </Button>
        )}
      </div>
      {waiting && !linked && (
        <p className="text-xs text-zinc-500">
          Press Start in the Telegram chat that opened. This page updates once it&apos;s connected.
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}

export function AccountPage() {
  const owner = useOwner();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Account</h1>
        <p className="mt-1 text-sm text-zinc-500">Signed in as {owner.email}.</p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-xl">
          <h2 className="font-medium text-white">Export your data</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Download your agents, contacts, conversations and ledgers as JSON, decrypted.
          </p>
        </div>
        <ButtonLink
          href={new URL("/v1/me/export", site.apiUrl).toString()}
          prefetch={false}
          variant="secondary"
        >
          Download JSON
        </ButtonLink>
      </Card>

      <TelegramConnection />

      <DomainVisibility />

      <DeleteAccount />
    </div>
  );
}
