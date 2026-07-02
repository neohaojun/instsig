import { Badge } from "@/components/ui/badge";
import { statusBadgeTone, statusDotTone, statusLabels } from "@/lib/request-meta";
import type { RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: RequestStatus }) {
  return (
    <Badge className={cn("gap-1.5 border normal-case", statusBadgeTone)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", statusDotTone[status])} />
      {statusLabels[status]}
    </Badge>
  );
}
