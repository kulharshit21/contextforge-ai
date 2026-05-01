import { format, formatDistanceToNow } from "date-fns";

export function isoNow() {
  return new Date().toISOString();
}

export function formatDateTime(input: string) {
  return format(new Date(input), "dd MMM yyyy, HH:mm");
}

export function relativeDate(input: string) {
  return formatDistanceToNow(new Date(input), { addSuffix: true });
}
