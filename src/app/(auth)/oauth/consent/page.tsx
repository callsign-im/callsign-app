import type { Metadata } from "next";
import { Suspense } from "react";
import { OAuthConsent } from "@/components/auth/oauth-consent";

export const metadata: Metadata = { title: "Connect an app · Callsign" };

export default function ConsentPage() {
  return (
    <Suspense>
      <OAuthConsent />
    </Suspense>
  );
}
