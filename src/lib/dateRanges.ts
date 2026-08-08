import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from "date-fns";

export type Period = "month" | "quarter" | "year" | "custom";

export interface DateRange {
  from: string; // yyyy-MM-dd, inclusive
  to: string; // yyyy-MM-dd, inclusive
  label: string;
}

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Resolves a period + optional explicit from/to (for "custom") into a concrete date range. */
export function resolveDateRange(
  period: Period,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date();

  switch (period) {
    case "month":
      return {
        from: iso(startOfMonth(now)),
        to: iso(endOfMonth(now)),
        label: format(now, "MMMM yyyy"),
      };
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) + 1;
      return {
        from: iso(startOfQuarter(now)),
        to: iso(endOfQuarter(now)),
        label: `Q${q} ${format(now, "yyyy")}`,
      };
    }
    case "year":
      return {
        from: iso(startOfYear(now)),
        to: iso(endOfYear(now)),
        label: format(now, "yyyy"),
      };
    case "custom":
    default:
      return {
        from: customFrom || iso(startOfMonth(now)),
        to: customTo || iso(now),
        label: "Custom range",
      };
  }
}
