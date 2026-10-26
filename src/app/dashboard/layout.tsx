import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";
import { LiveEventsProvider, SessionGate } from "@/components/dashboard/providers";
import { StepUpProvider } from "@/components/step-up";

export const metadata: Metadata = {
  title: "Dashboard · Callsign",
  robots: { index: false },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SessionGate>
      <LiveEventsProvider>
        <StepUpProvider>
          <DashboardShell>{children}</DashboardShell>
        </StepUpProvider>
      </LiveEventsProvider>
    </SessionGate>
  );
}
