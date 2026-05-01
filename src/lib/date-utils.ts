import { format } from "date-fns";

export function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function toLocalIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
