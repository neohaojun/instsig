import Link from "next/link";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { ClipboardList, LayoutDashboard, Users, Building2, FileText, CalendarClock } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

const userNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests/report-sick", label: "Report Sick", icon: FileText },
  { href: "/requests/external-appointment", label: "External Appointment", icon: CalendarClock },
];

const adminNav = [
  { href: "/admin", label: "Admin Overview", icon: ClipboardList },
  { href: "/admin/requests", label: "Request Queue", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/batches", label: "Batches", icon: Building2 },
];

function NavList({
  items,
  pathname,
}: {
  items: { href: string; label: string; icon: ComponentType<{ className?: string }> }[];
  pathname: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href as never}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
              active ? "border border-border bg-accent text-accent-foreground shadow-soft" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({
  pathname,
  role,
}: {
  pathname: string;
  role: "user" | "admin";
}) {
  return (
    <aside className="hidden h-[calc(100vh-73px)] w-72 shrink-0 flex-col border-r border-border bg-background px-4 py-6 lg:flex">
      <div className="space-y-5">
        <div>
          <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Overview</p>
          <NavList items={userNav} pathname={pathname} />
        </div>

        {role === "admin" ? (
          <div>
            <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Admin</p>
            <NavList items={adminNav} pathname={pathname} />
          </div>
        ) : null}
      </div>

      {role === "admin" ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-card-foreground">Admin access</p>
        </div>
      ) : null}

      <div className="mt-auto space-y-4 pt-6">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-card-foreground">Session</p>
          <div className="mt-3">
            <SignOutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
