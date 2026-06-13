"use client";

import Link from "next/link";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function TopBar({
  role,
  userName,
  userRank,
  userEmail,
}: {
  role?: "user" | "admin";
  userName?: string | null;
  userRank?: string | null;
  userEmail?: string | null;
}) {
  return (
    <header className="relative sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link href="/dashboard" className="truncate text-3xl font-semibold text-foreground transition hover:text-foreground/80">
            instsig
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <ProfileMenu
            profile={userName || userRank ? { full_name: userName ?? null, rank: userRank ?? null } : null}
            email={userEmail}
            role={role}
          />
        </div>
      </div>
    </header>
  );
}
