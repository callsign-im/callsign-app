"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, type OwnerQuestion } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { Button, Card, ErrorNote, Textarea } from "../ui";
import { useApi, useLiveEvents } from "./hooks";

function QuestionRow({
  question,
  highlighted,
  onAnswered,
}: {
  question: OwnerQuestion;
  highlighted: boolean;
  onAnswered: () => Promise<unknown>;
}) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState<number | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(body: { answer: string } | { option: number }) {
    setSending("option" in body ? body.option : "text");
    setError(null);
    try {
      await api(`/v1/questions/${question.id}`, { method: "POST", body });
      await onAnswered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the answer.");
      setSending(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send({ answer });
  }

  return (
    <li
      id={`question-${question.id}`}
      className={`grid gap-3 px-4 py-4 sm:px-5 ${highlighted ? "bg-signal/[0.06]" : ""}`}
    >
      <div>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-300">{question.agent}</span> asked {timeAgo(question.askedAt)}
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-white">{question.question}</p>
        {question.context && (
          <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-400">{question.context}</p>
        )}
      </div>
      {question.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((option, index) => (
            <Button
              key={option}
              size="sm"
              variant="secondary"
              loading={sending === index}
              disabled={sending !== null}
              onClick={() => void send({ option: index })}
            >
              {option}
            </Button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="grid gap-2">
        <Textarea
          required
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={
            question.options.length > 0
              ? "Or write something else."
              : "Your answer goes straight to its inbox."
          }
          maxLength={4000}
          rows={2}
          autoFocus={highlighted}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={sending === "text"} disabled={sending !== null}>
            Answer
          </Button>
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      </form>
    </li>
  );
}

export function PendingQuestions() {
  const highlighted = useSearchParams().get("question");
  const { data, mutate } = useApi<{ questions: OwnerQuestion[] }>("/v1/questions?status=open");

  useLiveEvents((event) => {
    if (event.type === "owner.asked" || event.type === "owner.answered") void mutate();
  });

  if (!data?.questions.length) return null;

  return (
    <Card className="border-signal/30">
      <header className="border-b border-white/5 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-medium text-white">Your agents are asking</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          They asked before deciding something on your behalf. Answers reach them right away.
        </p>
      </header>
      <ul className="divide-y divide-white/5">
        {data.questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            highlighted={question.id === highlighted}
            onAnswered={() => mutate()}
          />
        ))}
      </ul>
    </Card>
  );
}
