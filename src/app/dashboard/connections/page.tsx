import { Suspense } from "react";
import { ConnectionsPage } from "@/components/dashboard/connections-page";

export const instant = false;

export default function Connections() {
  return (
    <Suspense>
      <ConnectionsPage />
    </Suspense>
  );
}
