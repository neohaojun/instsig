import { format, isValid, parseISO } from "date-fns";

const DATE_DISPLAY_FORMAT = "dd/MM/yyyy";
const DATE_TIME_DISPLAY_FORMAT = "dd/MM/yyyy, HH:mm";

export function formatDisplayDate(value: string | Date | null | undefined, fallback = "") {
  if (!value) return fallback;
  const parsed = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(parsed)) return typeof value === "string" ? value : fallback;
  return format(parsed, DATE_DISPLAY_FORMAT);
}

export function formatDisplayDateTime(value: string | Date | null | undefined, fallback = "Not yet") {
  if (!value) return fallback;
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (!isValid(parsed)) return typeof value === "string" ? value : fallback;
  return format(parsed, DATE_TIME_DISPLAY_FORMAT);
}
