import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StrengthSummary } from "@/lib/strength-summary";

function StrengthMetric({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold leading-none ${tone}`}>{value}</p>
    </div>
  );
}

export function StrengthCard({
  summary,
  href,
  onSeeMore,
}: {
  summary: StrengthSummary;
  href?: string;
  onSeeMore?: () => void;
}) {
  const seeMoreButton = href ? (
    <Button asChild variant="link" className="h-auto px-0">
      <Link href={href as never}>See more</Link>
    </Button>
  ) : onSeeMore ? (
    <Button type="button" variant="link" className="h-auto px-0" onClick={onSeeMore}>
      See more
    </Button>
  ) : null;

  return (
    <Card className="overflow-hidden animate-enter-soft animate-delay-2">
      <CardHeader className="space-y-1 p-8">
        <CardTitle className="text-3xl">Strength</CardTitle>
        <p className="text-sm text-muted-foreground">
          {summary.activeBatches.length ? `${summary.activeBatches.join(", ")} SSCC` : "No active batch for today"}
        </p>
      </CardHeader>
      <CardContent className="p-8 pt-0">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
          <StrengthMetric label="Total" value={summary.total} />
          <StrengthMetric label="Current" value={summary.current} tone="text-emerald-500" />
          <StrengthMetric label="Attend C" value={summary.attendC} tone="text-red-500" />
          <StrengthMetric label="Attend B" value={summary.attendB} tone="text-amber-500" />
          <StrengthMetric label="Reporting Sick" value={summary.reportingSick} tone="text-yellow-500" />
        </div>
        {seeMoreButton ? <div className="pt-6">{seeMoreButton}</div> : null}
      </CardContent>
    </Card>
  );
}
