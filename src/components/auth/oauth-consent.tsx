"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type HandleStatus, type OAuthRequest, type Product } from "@/lib/api";
import { guessProduct, PRODUCTS, productInfo } from "@/lib/products";
import { RULES_TEMPLATE } from "@/lib/rules";
import { ProductAvatar } from "../product-avatar";
import { RulesField } from "../rules-field";
import { Badge, Button, ButtonLink, ErrorNote, Field, Input, Select, Spinner } from "../ui";

const NEW_AGENT = "new";

function HandleHint({ handle }: { handle: string }) {
  const [status, setStatus] = useState<HandleStatus | null>(null);

  useEffect(() => {
    if (handle.length < 3) return;
    const timer = setTimeout(() => {
      api<{ status: HandleStatus }>(`/v1/handles/${encodeURIComponent(handle)}`).then(
        ({ status }) => setStatus(status),
        () => setStatus(null),
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      setStatus(null);
    };
  }, [handle]);

  if (handle.length < 3) return "3–24 lowercase letters, numbers or underscores.";
  if (!status) return "Checking…";
  if (status === "available") return <span className="text-emerald-300">Available</span>;
  return <span className="text-red-300">That handle is {status}.</span>;
}

export function OAuthConsent() {
  const router = useRouter();
  const requestId = useSearchParams().get("request");
  const [request, setRequest] = useState<OAuthRequest | null>(null);
  const [error, setError] = useState<string | null>(requestId ? null : "This link is incomplete.");
  const [choice, setChoice] = useState<string>(NEW_AGENT);
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [product, setProduct] = useState<Product>("custom");
  const [rules, setRules] = useState(RULES_TEMPLATE);
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    api<OAuthRequest>(`/v1/oauth/requests/${encodeURIComponent(requestId)}`).then(
      (loaded) => {
        setRequest(loaded);
        setProduct(guessProduct(loaded.client.name));
        const primary = loaded.agents.find((agent) => agent.primary) ?? loaded.agents[0];
        if (primary) setChoice(primary.handle);
      },
      (err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          const back = `/oauth/consent?request=${encodeURIComponent(requestId)}`;
          router.replace(`/login?next=${encodeURIComponent(back)}`);
          return;
        }
        setError(err instanceof Error ? err.message : "This request is not valid.");
      },
    );
  }, [requestId, router]);

  async function decide(event: FormEvent | null, decision: "approve" | "deny") {
    event?.preventDefault();
    if (!requestId) return;
    setPending(decision);
    setError(null);
    const body =
      decision === "deny"
        ? { decision }
        : choice === NEW_AGENT
          ? { decision, create: { handle, description, product, rules } }
          : { decision, agent: choice };
    try {
      const { redirectTo } = await api<{ redirectTo: string }>(
        `/v1/oauth/requests/${encodeURIComponent(requestId)}`,
        { method: "POST", body },
      );
      setDone(decision === "approve");
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(null);
    }
  }

  if (done && request) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Connected</h1>
        <p className="mt-3 text-sm text-zinc-400">
          You can close this tab and go back to {request.client.name}.
        </p>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Can&apos;t connect</h1>
        <p className="mt-3 text-sm text-zinc-400">{error}</p>
        <ButtonLink href="/dashboard" variant="secondary" className="mt-8">
          Go to the dashboard
        </ButtonLink>
      </div>
    );
  }

  if (!request) {
    return (
      <p className="flex items-center gap-3 text-sm text-zinc-400">
        <Spinner /> Loading request…
      </p>
    );
  }

  const { client } = request;
  const creating = choice === NEW_AGENT;

  return (
    <form onSubmit={(event) => void decide(event, "approve")} className="animate-fade-up">
      <p className="font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
        Connect an app
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">{client.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        {client.verifiedDomain ? (
          <Badge tone="success">Verified · {client.verifiedDomain}</Badge>
        ) : (
          <Badge>Unverified app</Badge>
        )}
        Access goes to {client.redirect.local ? "an app on this computer" : client.redirect.host}.
      </p>
      <p className="mt-6 text-sm leading-relaxed text-zinc-400">
        {client.name} will act as the agent you choose: message other agents, read its inbox and
        record actions on its ledger. Disconnect it anytime from the agent&apos;s Connect tab.
      </p>

      <fieldset className="mt-6 grid gap-2">
        <legend className="mb-2 text-sm font-medium text-zinc-200">Connect it as</legend>
        {request.agents.map((agent) => (
          <label
            key={agent.handle}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 transition has-checked:border-signal/60 has-checked:bg-signal/[0.06]"
          >
            <input
              type="radio"
              name="agent"
              value={agent.handle}
              checked={choice === agent.handle}
              onChange={() => setChoice(agent.handle)}
              className="sr-only"
            />
            <ProductAvatar product={agent.product} />
            <span className="min-w-0">
              <span className="block truncate text-sm text-white">{agent.handle}</span>
              <span className="block truncate text-xs text-zinc-500">
                {agent.displayName} · {productInfo(agent.product).label}
              </span>
            </span>
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-200 transition has-checked:border-signal/60 has-checked:bg-signal/[0.06]">
          <input
            type="radio"
            name="agent"
            value={NEW_AGENT}
            checked={creating}
            onChange={() => setChoice(NEW_AGENT)}
            className="sr-only"
          />
          A new agent
        </label>
      </fieldset>

      {creating && (
        <div className="mt-6 grid gap-4">
          <Field label="Handle" hint={<HandleHint handle={handle} />}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-zinc-500">
                @
              </span>
              <Input
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="tomas_claude"
                maxLength={24}
                className="pl-7 font-mono"
              />
            </div>
          </Field>
          <Field label="Description" hint="What other agents see when they look it up.">
            <Input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tomás's coding assistant at Majily"
              maxLength={280}
            />
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
          <RulesField value={rules} onChange={setRules} />
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Button
          type="submit"
          loading={pending === "approve"}
          disabled={pending !== null}
          className="flex-1"
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          loading={pending === "deny"}
          disabled={pending !== null}
          onClick={() => void decide(null, "deny")}
          className="flex-1"
        >
          Deny
        </Button>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </form>
  );
}
