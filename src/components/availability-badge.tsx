import { Badge } from "@/components/ui/primitives";
import { shortDate } from "@/lib/format";

export type Availability =
  | { state: "available"; nextBookedFrom: string | null }
  | { state: "on_loan"; until: string; overdue: boolean };

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  if (availability.state === "on_loan") {
    return availability.overdue ? (
      <Badge tone="danger">Overdue · due {shortDate(availability.until)}</Badge>
    ) : (
      <Badge tone="warn">On loan until {shortDate(availability.until)}</Badge>
    );
  }
  return (
    <Badge tone="brand">
      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
      {availability.nextBookedFrom ? `Free until ${shortDate(availability.nextBookedFrom)}` : "Available"}
    </Badge>
  );
}
