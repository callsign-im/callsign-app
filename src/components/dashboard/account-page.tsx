"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { site } from "@/lib/site";
import { Button, ButtonLink, Card, ErrorNote, Input } from "../ui";
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

      <DeleteAccount />
    </div>
  );
}
