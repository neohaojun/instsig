"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await supabase.auth.signOut();
          router.push("/login");
          router.refresh();
        })
      }
    >
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
