"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PageCloseButton({
  className,
  label,
  mobileLabel = "Close",
  desktopLabel,
  onClick,
}: {
  className?: string;
  label?: string;
  mobileLabel?: string;
  desktopLabel?: string;
  onClick?: () => void;
}) {
  const router = useRouter();
  const resolvedDesktopLabel = desktopLabel ?? label ?? "Back";
  const resolvedMobileLabel = mobileLabel;
  const showBackIcon = resolvedDesktopLabel !== "Close";

  return (
    <div className={className}>
      <Button type="button" variant="outline" onClick={onClick ?? (() => router.back())}>
        {showBackIcon ? <ChevronLeft className="hidden h-4 w-4 sm:block" /> : null}
        <span className="sm:hidden">{resolvedMobileLabel}</span>
        <span className="hidden sm:inline">{resolvedDesktopLabel}</span>
      </Button>
    </div>
  );
}
