"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { ProfileMenu } from "@/components/layout/profile-menu";

const userNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/requests/report-sick", label: "Report sick" },
  { href: "/requests/external-appointment", label: "External appointment" },
  { href: "/history", label: "Existing requests" },
];

const adminNav = [
  { href: "/admin", label: "Admin" },
  { href: "/admin/requests", label: "Queue" },
];

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
  const navItems = role === "admin" ? [...userNav, ...adminNav] : userNav;
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header className="relative sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link href="/dashboard" className="truncate text-base font-semibold text-zinc-100 text-3xl transition hover:text-white">
            instsig
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ProfileMenu profile={userName || userRank ? { full_name: userName ?? null, rank: userRank ?? null } : null} email={userEmail} />

          {role === "admin" ? (
            <div ref={mobileMenuRef} className="relative sm:hidden">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((value) => !value)}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-zinc-200 transition hover:bg-white/[0.07]"
              >
                <Menu className="h-5 w-5" />
              </button>
              {mobileOpen ? (
                <div role="menu" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-soft backdrop-blur">
                  <div className="flex flex-col gap-1 p-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        className="rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
                        href={item.href as never}
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
