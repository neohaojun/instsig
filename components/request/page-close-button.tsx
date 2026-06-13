"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PageCloseButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <div className={className}>
      <Button type="button" variant="outline" onClick={() => router.back()}>
        Close
      </Button>
    </div>
  );
}
