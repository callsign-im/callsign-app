"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, setStepUpHandler } from "@/lib/api";
import { confirmPasskey, passkeyError } from "@/lib/passkeys";
import { ShieldIcon } from "./icons";
import { Button, ErrorNote } from "./ui";

type Pending = { resolve: () => void; reject: (reason: Error) => void };

/**
 * When the API answers step_up_required, asks the owner for their passkey and lets the request
 * retry. The click on "Use passkey" is what browsers need to show the prompt.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const waiting = useRef<Promise<void> | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStepUpHandler(() => {
      waiting.current ??= new Promise<void>((resolve, reject) => {
        setError(null);
        setPending({ resolve, reject });
      }).finally(() => {
        waiting.current = null;
      });
      return waiting.current;
    });
    return () => setStepUpHandler(null);
  }, []);

  useEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
    if (!pending && dialog.current?.open) dialog.current.close();
  }, [pending]);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await confirmPasskey();
      pending.resolve();
      setPending(null);
    } catch (err) {
      setError(passkeyError(err, "Couldn't check your passkey."));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    pending?.reject(
      new ApiError(
        403,
        "step_up_cancelled",
        "This change needs your passkey. Nothing was changed.",
      ),
    );
    setPending(null);
  }

  return (
    <>
      {children}
      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
        aria-labelledby="step-up-title"
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/10 bg-panel p-6 text-left text-white backdrop:bg-black/70"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <ShieldIcon className="size-5 text-zinc-200" />
        </span>
        <h2 id="step-up-title" className="mt-4 text-lg font-semibold tracking-tight">
          Confirm it&apos;s you
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          This change needs your passkey. Callsign asks for it before sensitive changes, so a stolen
          session can&apos;t make them.
        </p>
        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <Button onClick={() => void confirm()} loading={busy} autoFocus>
            Use passkey
          </Button>
          <Button variant="ghost" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </dialog>
    </>
  );
}
