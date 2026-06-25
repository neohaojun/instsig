import { cn } from "@/lib/utils";

export function LoadingScreen({ className }: { className?: string }) {
  return (
    <main
      className={cn(
        "flex min-h-screen min-h-dvh items-center justify-center bg-background px-6 text-foreground",
        className,
      )}
    >
      <div className="grid w-full max-w-sm gap-6 rounded-2xl border border-border bg-card/80 p-8 text-card-foreground shadow-soft backdrop-blur">
        <p className="text-3xl font-semibold tracking-tight">instsig</p>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-loading-bar rounded-full bg-primary" />
        </div>
      </div>
    </main>
  );
}
