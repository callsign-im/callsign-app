"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type AnswerLink } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Button, ButtonLink, ErrorNote, Spinner, Textarea } from "../ui";

const WRITE = -1;

export function AnswerQuestion() {
  const params = useSearchParams();
  const token = params.get("token");
  const preselected = Number(params.get("option") ?? WRITE);
  const [link, setLink] = useState<AnswerLink | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This link is incomplete.");
  const [choice, setChoice] = useState(WRITE);
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<AnswerLink>(`/v1/answers/${encodeURIComponent(token)}`).then(
      (found) => {
        setLink(found);
        if (preselected >= 0 && preselected < found.options.length) setChoice(preselected);
      },
      (err: unknown) => setError(err instanceof Error ? err.message : "This link is not valid."),
    );
  }, [token, preselected]);

  async function submit() {
    if (!token) return;
    setSending(true);
    setError(null);
    try {
      const result = await api<{ agent: string; answer: string }>(
        `/v1/answers/${encodeURIComponent(token)}`,
        { method: "POST", body: choice === WRITE ? { answer } : { option: choice } },
      );
      setSent(result.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the answer.");
    } finally {
      setSending(false);
    }
  }

  if (sent !== null && link) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Answer sent</h1>
        <p className="mt-3 text-sm text-zinc-400">
          {link.agent} got “{sent}” in its inbox and can carry on.
        </p>
        <ButtonLink href="/dashboard" variant="secondary" className="mt-8">
          Open the dashboard
        </ButtonLink>
      </div>
    );
  }

  if (error && !link) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Link not valid</h1>
        <p className="mt-3 text-sm text-zinc-400">{error}</p>
        <ButtonLink href="/dashboard" className="mt-8">
          Open the dashboard
        </ButtonLink>
      </div>
    );
  }

  if (!link) {
    return (
      <p className="flex items-center gap-3 text-sm text-zinc-400">
        <Spinner /> Loading question…
      </p>
    );
  }

  const ready = choice !== WRITE || answer.trim().length > 0;

  return (
    <div className="animate-fade-up grid gap-6">
      <div>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-300">{link.agent}</span> asked {timeAgo(link.askedAt)}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight whitespace-pre-wrap text-white">
          {link.question}
        </h1>
        {link.context && (
          <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-400">{link.context}</p>
        )}
      </div>

      <div className="grid gap-2" role="radiogroup" aria-label="Your answer">
        {link.options.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choice === index}
            onClick={() => setChoice(index)}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              choice === index
                ? "border-signal/60 bg-signal/10 text-white"
                : "border-white/10 text-zinc-200 hover:bg-white/5"
            }`}
          >
            {option}
          </button>
        ))}
        {link.options.length > 0 && (
          <button
            type="button"
            role="radio"
            aria-checked={choice === WRITE}
            onClick={() => setChoice(WRITE)}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              choice === WRITE
                ? "border-signal/60 bg-signal/10 text-white"
                : "border-white/10 text-zinc-400 hover:bg-white/5"
            }`}
          >
            Something else
          </button>
        )}
        {choice === WRITE && (
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer goes straight to its inbox."
            maxLength={4000}
            rows={3}
            autoFocus
          />
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <Button onClick={() => void submit()} loading={sending} disabled={!ready}>
        Send answer
      </Button>
      <p className="text-xs text-zinc-500">
        This link works once. Anyone with it can answer, so don&apos;t forward the email.
      </p>
    </div>
  );
}
