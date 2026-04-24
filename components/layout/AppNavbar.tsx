"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/layout/SignOutButton";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/gm", label: "GM" },
  { href: "/player", label: "Player" },
  { href: "/profile", label: "Profile" },
] as const;

export function AppNavbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-zinc-50/90 backdrop-blur-md dark:border-zinc-600/50 dark:bg-zinc-800/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="shrink-0 text-sm font-semibold tracking-tight text-zinc-900 dark:text-white"
        >
          Umbral Sanctuary
        </Link>
        <nav className="ml-auto flex max-w-[calc(100%-8rem)] items-center gap-0.5 overflow-x-auto sm:gap-1">
          {links.map(({ href, label }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors sm:px-3",
                  isActive
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                )}
              >
                {label}
              </Link>
            );
          })}
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
