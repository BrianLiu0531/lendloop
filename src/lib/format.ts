import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";

/** Local calendar date as YYYY-MM-DD. */
export function localIsoDate(d = new Date()) {
  return format(d, "yyyy-MM-dd");
}

export function shortDate(iso: string) {
  return format(parseISO(iso), "MMM d");
}

export function dateRange(start: string, end: string) {
  if (start === end) return format(parseISO(start), "EEE, MMM d");
  const s = parseISO(start);
  const e = parseISO(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return sameMonth ? `${format(s, "MMM d")} – ${format(e, "d")}` : `${format(s, "MMM d")} – ${format(e, "MMM d")}`;
}

export function nights(start: string, end: string) {
  const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function ago(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 45_000) return "just now";
  return `${formatDistanceToNowStrict(ms)} ago`;
}

export function daysUntil(iso: string, today: string) {
  return differenceInCalendarDays(parseISO(iso), parseISO(today));
}
