import { Suspense } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-10 sm:px-6 lg:px-8 animate-enter">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-soft">
            Loading sign in form...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
