import { Badge } from "@/components/ui/badge";
import { statusLabels, statusTone } from "@/lib/request-meta";
import type { RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: RequestStatus }) {
  return <Badge className={cn("border", statusTone[status])}>{statusLabels[status]}</Badge>;
}
