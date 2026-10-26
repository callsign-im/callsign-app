import { Suspense } from "react";
import { ConnectionDetail } from "@/components/dashboard/connection-detail";

export const instant = false;

export default function ConnectionPage() {
  return (
    <Suspense>
      <ConnectionDetail />
    </Suspense>
  );
}
