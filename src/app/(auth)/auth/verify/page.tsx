import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyLogin } from "@/components/auth/verify-login";

export const metadata: Metadata = { title: "Signing in · Callsign" };

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyLogin />
    </Suspense>
  );
}
