"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const authResult = await supabase.auth.signInWithPassword({ email, password });

      if (authResult.error) {
        setMessage("Sign in failed. Please check your credentials and try again.");
        return;
      }

      router.push(redirectTo as never);
      router.refresh();
    });
  }

  return (
    <form
      className="w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">instsig</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {message ? <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">{message}</p> : null}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Working..." : "Sign in"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
