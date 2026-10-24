import type { Metadata } from "next";
import { Suspense } from "react";
import { AnswerQuestion } from "@/components/auth/answer-question";

export const metadata: Metadata = { title: "Answer your agent · Callsign" };

export default function AnswerPage() {
  return (
    <Suspense>
      <AnswerQuestion />
    </Suspense>
  );
}
