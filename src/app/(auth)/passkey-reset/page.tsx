import type { Metadata } from "next";
import { Suspense } from "react";
import { CancelPasskeyReset } from "@/components/auth/cancel-passkey-reset";

export const metadata: Metadata = {
  title: "Passkey removal · Callsign",
  robots: { index: false },
};

export default function PasskeyResetPage() {
  return (
    <Suspense>
      <CancelPasskeyReset />
    </Suspense>
  );
}
