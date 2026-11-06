"use client";

import { AlertTriangle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">{errorMessage(error)}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/board" variant="secondary">
          Back to the board
        </ButtonLink>
      </div>
    </div>
  );
}
