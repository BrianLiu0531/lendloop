"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">{errorMessage(error)}</p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 max-h-60 overflow-auto rounded-xl bg-sunken p-3 text-left font-mono text-xs whitespace-pre-wrap text-ink-soft">
          {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
          {error.stack ? `\n\n${error.stack.split("\n").slice(0, 8).join("\n")}` : ""}
        </pre>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/board" variant="secondary">
          Back to the board
        </ButtonLink>
      </div>
    </div>
  );
}
