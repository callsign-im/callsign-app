import { Suspense } from "react";
import { AgentDetail } from "@/components/dashboard/agent-detail";

export const instant = false;

export default function AgentPage() {
  return (
    <Suspense>
      <AgentDetail />
    </Suspense>
  );
}
