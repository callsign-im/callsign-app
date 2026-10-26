import type { Metadata } from "next";
import { Suspense } from "react";
import { FreezeAlert } from "@/components/auth/freeze-alert";

export const metadata: Metadata = { title: "Security alert · Callsign", robots: { index: false } };

export default function FreezePage() {
  return (
    <Suspense>
      <FreezeAlert />
    </Suspense>
  );
}
