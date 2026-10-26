import type { Metadata } from "next";
import { Suspense } from "react";
import { OAuthConsent } from "@/components/auth/oauth-consent";
import { StepUpProvider } from "@/components/step-up";

export const metadata: Metadata = { title: "Connect an app · Callsign" };

export default function ConsentPage() {
  return (
    <StepUpProvider>
      <Suspense>
        <OAuthConsent />
      </Suspense>
    </StepUpProvider>
  );
}
