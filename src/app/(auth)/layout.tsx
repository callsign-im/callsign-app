import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col px-4 sm:px-6">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center">
        <a href={site.url} aria-label="Callsign home">
          <Logo />
        </a>
      </header>
      <main className="flex flex-1 items-center justify-center pb-24">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
