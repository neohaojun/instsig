import type { RequestRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type StageState = "complete" | "current" | "upcoming" | "rejected";

const stages = [
  {
    key: "pending-review",
    letter: "P",
    shortLabel: "Pending",
    label: "Pending review",
    description: "Initial request submitted and waiting for admin review.",
  },
  {
    key: "approved",
    letter: "A",
    shortLabel: "Approved",
    label: "Approved",
    description: "Admin approved the initial request. Post-visit details are next.",
  },
  {
    key: "pending-final",
    letter: "P",
    shortLabel: "Pending",
    label: "Pending finalization",
    description: "Post-visit details submitted for final admin review.",
  },
  {
    key: "finalized",
    letter: "F",
    shortLabel: "Finalized",
    label: "Finalized",
    description: "Request finalized.",
  },
] as const;

function getStageIndex(request: RequestRecord, hasFollowup: boolean) {
  if (request.status === "finalized" || request.finalized_at) return 4;
  if (request.status === "submitted" || request.followup_submitted_at || hasFollowup) return 3;
  if (request.status === "approved" || request.approved_at) return 2;
  return 1;
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

function getStageState(stageNumber: number, currentIndex: number, rejected: boolean): StageState {
  if (rejected && stageNumber === currentIndex) return "rejected";
  if (stageNumber < currentIndex) return "complete";
  if (stageNumber === currentIndex) return "current";
  return "upcoming";
}

function getStageColor(state: StageState) {
  if (state === "complete") return "#f4f4f5";
  if (state === "current") return "rgba(244,244,245,0.58)";
  if (state === "rejected") return "#fb7185";
  return "rgba(255,255,255,0.12)";
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
  const currentStage = stages[Math.max(0, Math.min(currentIndex - 1, stages.length - 1))];
  const ringColors = stages.map((_, index) => getStageColor(getStageState(index + 1, currentIndex, rejected)));
  const ringStyle = {
    background: `conic-gradient(${ringColors[0]} 0deg 82deg, transparent 82deg 90deg, ${ringColors[1]} 90deg 172deg, transparent 172deg 180deg, ${ringColors[2]} 180deg 262deg, transparent 262deg 270deg, ${ringColors[3]} 270deg 352deg, transparent 352deg 360deg)`,
  };

  return (
    <div
      className={cn("group relative inline-flex shrink-0 items-center justify-center", className)}
      tabIndex={0}
      title={getStageDescription(request, hasFollowup)}
      aria-label={getStageDescription(request, hasFollowup)}
    >
      <div
        className="relative h-14 w-14 rounded-full p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        style={ringStyle}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-lg font-semibold text-zinc-100">
          {rejected ? "R" : currentStage.letter}
        </div>
      </div>
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-zinc-950/95 p-4 text-sm leading-6 text-zinc-300 opacity-0 shadow-soft transition group-hover:opacity-100 group-focus:opacity-100">
        <p className="font-medium text-zinc-100">{rejected ? "Rejected" : currentStage.label}</p>
        <p className="mt-1">{getStageDescription(request, hasFollowup)}</p>
      </div>
    </div>
  );
}
