import Link from "next/link";
import { format } from "date-fns";
import type { RequestRecord } from "@/lib/types";
import { requestKindLabels } from "@/lib/request-meta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/request/status-pill";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function RequestList({
  requests,
  getHref,
}: {
  requests: RequestRecord[];
  getHref?: (request: RequestRecord) => string;
}) {
  if (!requests.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>No requests yet</CardTitle>
          <CardDescription>Start with a sick report or an external appointment request.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Recent requests</CardTitle>
          <CardDescription>Track status updates and open requests for review.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium text-zinc-100">{requestKindLabels[request.kind]}</TableCell>
                <TableCell>
                  <StatusPill status={request.status} />
                </TableCell>
                <TableCell className="text-zinc-400">{request.requester_email}</TableCell>
                <TableCell className="text-zinc-400">
                  {format(new Date(request.created_at), "dd MMM yyyy, HH:mm")}
                </TableCell>
                <TableCell className="max-w-[22rem] text-zinc-400">
                  {request.review_note ? request.review_note : "No admin note yet."}
                </TableCell>
                <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={(getHref?.(request) ?? `/requests/${request.kind}?id=${request.id}`) as never}>
                    {request.kind === "report_sick"
                      ? request.status === "approved"
                        ? "Continue"
                        : request.status === "submitted" || request.status === "finalized" || request.status === "rejected"
                          ? "View"
                          : "Open"
                      : request.status === "pending" || request.status === "needs_changes" || request.status === "draft"
                        ? "Open"
                        : "View"}
                  </Link>
                </Button>
              </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
