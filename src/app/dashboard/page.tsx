import { Suspense } from "react";
import { Overview } from "@/components/dashboard/overview";

export const instant = false;

export default function DashboardPage() {
  return (
    <Suspense>
      <Overview />
    </Suspense>
  );
}
