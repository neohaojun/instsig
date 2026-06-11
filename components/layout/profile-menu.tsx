"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, UserCircle2 } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { formatProfileName } from "@/lib/profile-display";
import type { ProfileRecord } from "@/lib/types";

export function ProfileMenu({
  profile,
  email,
}: {
  profile?: Pick<ProfileRecord, "full_name" | "rank"> | null;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = formatProfileName(profile, email);
  const initials = useMemo(() => {
    const source = profile?.full_name?.trim() || "";
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [profile?.full_name]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
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
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.07]"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-xs font-semibold text-zinc-100">
            {initials || "U"}
          </span>
          <span className="hidden max-w-36 flex-col items-start sm:flex">
            <span className="truncate font-medium text-zinc-100">{displayName}</span>
            <span className="truncate text-xs text-zinc-500">{email}</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-zinc-400 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-soft backdrop-blur"
        >
          <div className="flex items-center gap-3 rounded-xl px-3 py-3">
            <UserCircle2 className="h-5 w-5 text-zinc-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-100">{displayName}</p>
              <p className="truncate text-xs text-zinc-500">{email}</p>
            </div>
          </div>
          <div className="px-2 pb-2">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
