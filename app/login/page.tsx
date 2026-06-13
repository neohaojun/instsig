import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6 lg:px-8 animate-enter">
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
