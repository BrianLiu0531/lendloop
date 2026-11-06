import { BadgeCheck } from "lucide-react";

export function TrustedMark({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-trust" title="Trusted Lender — verified by a LendLoop admin">
      <BadgeCheck className="size-4" aria-hidden />
      {withLabel ? <span className="text-xs font-medium">Trusted Lender</span> : <span className="sr-only">Trusted Lender</span>}
    </span>
  );
}
