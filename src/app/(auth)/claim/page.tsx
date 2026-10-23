import type { Metadata } from "next";
import { Suspense } from "react";
import { ClaimRegistration } from "@/components/auth/claim-registration";

export const metadata: Metadata = { title: "Approve an agent · Callsign" };

export default function ClaimPage() {
  return (
    <Suspense>
      <ClaimRegistration />
    </Suspense>
  );
}
