"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { Logo, LogoMark } from "../logo";
import { Badge, Button } from "../ui";
import { usePendingApprovals } from "./approvals";
import { useOwner } from "./hooks";

const NAV = [
  { href: "/dashboard", label: "Agents" },
  { href: "/dashboard/connections", label: "Connections" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/account", label: "Account" },
];

const ADMIN = { href: "/dashboard/admin", label: "Reports" };
const APPROVALS = { href: "/dashboard/approvals", label: "Approvals" };

export function DashboardShell({ children }: { children: ReactNode }) {
  const owner = useOwner();
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const [signingOut, setSigningOut] = useState(false);
  const pending = usePendingApprovals();
  const items = [
    ...NAV.slice(0, 1),
    ...(pending > 0 || pathname.startsWith(APPROVALS.href) ? [APPROVALS] : []),
    ...NAV.slice(1),
    ...(owner.admin ? [ADMIN] : []),
  ];

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
              {items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard" || pathname.startsWith("/dashboard/agents")
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition sm:px-3 ${
                      active ? "bg-white/[0.06] text-white" : "text-zinc-500 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {item === APPROVALS && pending > 0 && <Badge tone="signal">{pending}</Badge>}
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
