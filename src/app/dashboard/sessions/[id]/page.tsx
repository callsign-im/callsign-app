import { Suspense } from "react";
import { LiveSessionPage } from "@/components/dashboard/live-sessions";

export const instant = false;

export default function SessionPage() {
  return (
    <Suspense>
      <LiveSessionPage />
    </Suspense>
  );
}
