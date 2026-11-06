"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Input } from "@/components/ui/primitives";

export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  tone = "danger",
  onConfirm,
  reasonLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  onConfirm: (reason?: string) => Promise<void>;
  /** When set, asks for an optional free-text reason (e.g. moderation). */
  reasonLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-sm leading-relaxed text-ink-soft">{children}</div>
        {reasonLabel && (
          <Field label={reasonLabel} htmlFor="confirm-reason">
            <Input id="confirm-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-5">
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim() || undefined);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
