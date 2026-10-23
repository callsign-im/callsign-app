"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { takePendingHandle } from "@/lib/pending-handle";
import { ButtonLink, Spinner } from "../ui";

export function VerifyLogin() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api("/v1/auth/verify", { method: "POST", body: { token } }).then(
      () => {
        const claim = takePendingHandle();
        router.replace(claim ? `/dashboard?claim=${encodeURIComponent(claim)}` : "/dashboard");
      },
      (err: unknown) => setError(err instanceof Error ? err.message : "Sign-in failed."),
    );
  }, [token, router]);

  if (!token || error) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Link not valid</h1>
        <p className="mt-3 text-sm text-zinc-400">
          {error ?? "This sign-in link is incomplete."} Request a new one to continue.
        </p>
        <ButtonLink href="/login" className="mt-8">
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-3 text-sm text-zinc-400">
      <Spinner /> Signing you in…
    </p>
  );
}
