import { StrengthCard } from "@/components/dashboard/strength-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatProfileName } from "@/lib/profile-display";
import type { ProfileRecord } from "@/lib/types";
import type { StrengthCategoryEntry, StrengthCategoryKey, StrengthDetails } from "@/lib/strength-summary";

const categoryCards: {
  key: StrengthCategoryKey;
  title: string;
  emptyText: string;
  dotClassName: string;
}[] = [
  { key: "attendC", title: "Attend C", emptyText: "No personnel on MC.", dotClassName: "bg-red-500" },
  { key: "attendB", title: "Attend B", emptyText: "No personnel on status.", dotClassName: "bg-amber-500" },
  { key: "reportingSick", title: "Reporting Sick", emptyText: "No one reporting sick today.", dotClassName: "bg-yellow-500" },
  { key: "externalAppointment", title: "External Appt", emptyText: "No external appointments today.", dotClassName: "bg-orange-500" },
  { key: "guardDuty", title: "Guard Duty", emptyText: "No guard duty today.", dotClassName: "bg-zinc-400" },
  { key: "onMedication", title: "On Medication", emptyText: "No personnel on medication past 24h.", dotClassName: "bg-zinc-400" },
  { key: "others", title: "Others", emptyText: "No other absences.", dotClassName: "bg-zinc-400" },
];

function StrengthPersonRow({
  entry,
  profilesById,
}: {
  entry: StrengthCategoryEntry;
  profilesById: Record<string, ProfileRecord | null | undefined>;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <p className="truncate text-sm font-medium text-card-foreground">
        {formatProfileName(profilesById[entry.profileId], entry.fallbackName)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{entry.meta}</p>
    </div>
  );
}

export function StrengthDetail({
  details,
  profilesById,
  showSummaryTitle = true,
}: {
  details: StrengthDetails;
  profilesById: Record<string, ProfileRecord | null | undefined>;
  showSummaryTitle?: boolean;
}) {
  return (
    <div className="grid gap-6">
      {showSummaryTitle ? <StrengthCard summary={details.summary} /> : null}
      {!showSummaryTitle ? (
        <div className="rounded-2xl border border-border bg-card p-8 animate-enter-soft">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-3xl font-bold leading-none text-foreground">{details.summary.total}</p>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Current</p>
              <p className="text-3xl font-bold leading-none text-emerald-500">{details.summary.current}</p>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Attend C</p>
              <p className="text-3xl font-bold leading-none text-red-500">{details.summary.attendC}</p>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Attend B</p>
              <p className="text-3xl font-bold leading-none text-amber-500">{details.summary.attendB}</p>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Reporting Sick</p>
              <p className="text-3xl font-bold leading-none text-yellow-500">{details.summary.reportingSick}</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        {categoryCards.map((card) => {
          const entries = details.categories[card.key];

          return (
            <Card key={card.key} className="overflow-hidden animate-enter-soft">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className={`h-2.5 w-2.5 rounded-full ${card.dotClassName}`} />
                  {card.title} ({entries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                {entries.length ? (
                  entries.map((entry) => <StrengthPersonRow key={entry.id} entry={entry} profilesById={profilesById} />)
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">{card.emptyText}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
