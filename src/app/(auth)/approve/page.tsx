import type { Metadata } from "next";
import { Suspense } from "react";
import { ApproveAction } from "@/components/auth/approve-action";

export const metadata: Metadata = {
  title: "Approve an action · Callsign",
  robots: { index: false },
};

export default function ApprovePage() {
  return (
    <Suspense>
      <ApproveAction />
    </Suspense>
  );
}
