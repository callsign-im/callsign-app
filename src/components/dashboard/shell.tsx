"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { Logo, LogoMark } from "../logo";
import { Button } from "../ui";
import { useOwner } from "./hooks";

const NAV = [
  { href: "/dashboard", label: "Agents" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/account", label: "Account" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const owner = useOwner();
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await api("/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    await mutate(() => true, undefined, { revalidate: false });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/dashboard" aria-label="Dashboard">
              <LogoMark className="size-[22px] text-white sm:hidden" />
              <span className="hidden sm:block">
                <Logo />
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard" || pathname.startsWith("/dashboard/agents")
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-2.5 py-1.5 transition sm:px-3 ${
                      active ? "bg-white/[0.06] text-white" : "text-zinc-500 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-zinc-500 sm:block">{owner.email}</span>
            <Button variant="ghost" size="sm" loading={signingOut} onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
