"use client";

import { useMutation } from "convex/react";
import { addDays, format, parseISO } from "date-fns";
import { CalendarX2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LIMITS } from "../../convex/lib/validators";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { dateRange, nights } from "@/lib/format";

type Booked = { startDate: string; endDate: string };

const plus = (iso: string, days: number) => format(addDays(parseISO(iso), days), "yyyy-MM-dd");

/**
 * Validation here mirrors the server rules for instant feedback only — the
 * Convex mutation re-validates everything and is the source of truth.
 */
function validate(start: string, end: string, today: string, booked: Booked[]) {
  if (!start || !end) return "Pick a start and return date.";
  if (start < today) return "The start date can't be in the past.";
  if (end < start) return "The return date must be on or after the start date.";
  const days = (parseISO(end).getTime() - parseISO(start).getTime()) / 86_400_000 + 1;
  if (days > LIMITS.maxLoanDays) return `A single loan can last at most ${LIMITS.maxLoanDays} days.`;
  const clash = booked.find((b) => start <= b.endDate && b.startDate <= end);
  if (clash) return `Already booked ${dateRange(clash.startDate, clash.endDate)}.`;
  return null;
}

export function RequestDialog({
  open,
  onClose,
  tool,
  today,
  booked,
}: {
  open: boolean;
  onClose: () => void;
  tool: { _id: Id<"tools">; name: string; ownerName: string };
  today: string;
  booked: Booked[];
}) {
  const request = useMutation(api.loans.request);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(plus(today, 2));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const problem = validate(start, end, today, booked);
  const upcoming = booked.filter((b) => b.endDate >= today);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problem) return;
    setSubmitting(true);
    try {
      await request({ toolId: tool._id, startDate: start, endDate: end, message: message.trim() || undefined });
      toast.success("Request sent", { description: `${tool.ownerName} will get a notification right away.` });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Borrow ${tool.name}`} description={`from ${tool.ownerName}`}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pick up" htmlFor="start">
            <Input
              id="start"
              type="date"
              value={start}
              min={today}
              max={plus(today, LIMITS.maxDaysAhead)}
              onChange={(e) => {
                setStart(e.target.value);
                if (e.target.value > end) setEnd(e.target.value);
              }}
              required
            />
          </Field>
          <Field label="Return by" htmlFor="end">
            <Input
              id="end"
              type="date"
              value={end}
              min={start || today}
              max={start ? plus(start, LIMITS.maxLoanDays - 1) : undefined}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </Field>
        </div>

        {upcoming.length > 0 && (
          <div className="rounded-lg bg-sunken px-4 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-faint">
              <CalendarX2 className="size-3.5" aria-hidden /> Already booked
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {upcoming.map((b) => (
                <li key={b.startDate} className="rounded-md bg-surface px-2 py-0.5 text-sm text-ink-soft">
                  {dateRange(b.startDate, b.endDate)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field
          label="Note to the owner (optional)"
          htmlFor="message"
          counter={`${message.length}/${LIMITS.requestMessage.max}`}
          hint="What's it for? A short note makes a yes more likely."
        >
          <Textarea
            id="message"
            value={message}
            maxLength={LIMITS.requestMessage.max}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hanging shelves this weekend — I'll bring it back Sunday evening."
          />
        </Field>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
          <p className={problem && touched ? "text-sm text-danger" : "text-sm text-ink-soft"} role="status">
            {problem && touched ? problem : !problem ? `${dateRange(start, end)} · ${nights(start, end)}` : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={touched && !!problem}>
              Send request
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
