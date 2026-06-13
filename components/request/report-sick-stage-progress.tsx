import type { RequestRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type StageState = "complete" | "current" | "upcoming" | "rejected";

const stages = ["Initial request", "Admin approval", "Post-visit details", "Final review"] as const;

function getStageIndex(request: RequestRecord, hasFollowup: boolean) {
  if (request.status === "finalized" || request.finalized_at) return 4;
  if (request.status === "submitted" || request.followup_submitted_at || hasFollowup) return 4;
  if (request.status === "approved" || request.approved_at) return 3;
  if (request.status === "rejected" || request.rejected_at) return 2;
  if (request.status === "draft" || request.status === "needs_changes") return 1;
  return 2;
}

function getStageCount(request: RequestRecord, currentIndex: number) {
  if (request.status === "finalized" || request.finalized_at) return stages.length;
  return Math.max(1, currentIndex - 1);
}

function getProgressPercent(request: RequestRecord, currentIndex: number) {
  if (request.status === "rejected" || request.rejected_at) return 50;
  if (request.status === "finalized" || request.finalized_at) return 100;
  return ((currentIndex - 1) / (stages.length - 1)) * 100;
}

function getStageDescription(request: RequestRecord, hasFollowup: boolean) {
  if (request.status === "rejected" || request.rejected_at) return "Request rejected during admin review.";
  if (request.status === "finalized" || request.finalized_at) return "Request finalized.";
  if (request.status === "submitted" || request.followup_submitted_at || hasFollowup) return "Post-visit details submitted for final review.";
  if (request.status === "approved" || request.approved_at) return "Admin approved the initial request. Post-visit details are next.";
  if (request.status === "needs_changes") return "Initial request needs changes before review can continue.";
  if (request.status === "draft") return "Initial request is still being prepared.";
  return "Initial request submitted and waiting for admin review.";
}

export function ReportSickStageProgress({
  request,
  hasFollowup = false,
  className,
}: {
  request: RequestRecord;
  hasFollowup?: boolean;
  className?: string;
}) {
  const rejected = request.status === "rejected" || Boolean(request.rejected_at);
  const currentIndex = getStageIndex(request, hasFollowup);
  const stageCount = getStageCount(request, currentIndex);
  const progressPercent = getProgressPercent(request, currentIndex);

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-zinc-950/35 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Request stage</p>
          <p className="mt-1 text-sm leading-6 text-zinc-300">{getStageDescription(request, hasFollowup)}</p>
        </div>
        <p className="text-sm font-medium text-zinc-100">
          {rejected ? "Rejected" : `${stageCount} of ${stages.length}`}
        </p>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full bg-zinc-100 transition-all", rejected && "bg-rose-400")}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {stages.map((stage, index) => {
          const stageNumber = index + 1;
          const state: StageState = rejected && index === 1
            ? "rejected"
            : stageNumber < currentIndex || (!rejected && stageCount === stages.length)
              ? "complete"
              : stageNumber === currentIndex
                ? "current"
                : "upcoming";

          return (
            <div key={stage} className="flex items-center gap-2 text-xs text-zinc-400 sm:block">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold sm:mb-2",
                  state === "complete" && "border-zinc-100 bg-zinc-100 text-zinc-950",
                  state === "current" && "border-white/30 bg-white/10 text-zinc-100",
                  state === "upcoming" && "border-white/10 bg-white/[0.03] text-zinc-500",
                  state === "rejected" && "border-rose-400/50 bg-rose-400/15 text-rose-200",
                )}
              >
                {stageNumber}
              </span>
              <span className={cn("font-medium", state === "current" && "text-zinc-100", state === "rejected" && "text-rose-200")}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
