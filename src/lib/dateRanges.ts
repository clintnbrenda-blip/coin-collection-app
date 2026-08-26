import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  format,
  parseISO,
} from "date-fns";

export type Period = "lastMonth" | "month" | "quarter" | "year" | "custom";

export interface DateRange {
  from: string; // yyyy-MM-dd, inclusive
  to: string; // yyyy-MM-dd, inclusive
  label: string;
}

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Resolves a period + optional explicit from/to (for "custom") into a concrete date range.
 * `target` anchors month/quarter/year to a specific date instead of today — used when
 * drilling into a past month from the yearly/quarterly breakdown.
 */
export function resolveDateRange(
  period: Period,
  customFrom?: string,
  customTo?: string,
  target?: string
): DateRange {
  const anchor = target ? parseISO(target) : new Date();

  switch (period) {
    case "lastMonth": {
      const lastMonth = subMonths(anchor, 1);
      return {
        from: iso(startOfMonth(lastMonth)),
        to: iso(endOfMonth(lastMonth)),
        label: format(lastMonth, "MMMM yyyy"),
      };
    }
    case "month":
      return {
        from: iso(startOfMonth(anchor)),
        to: iso(endOfMonth(anchor)),
        label: format(anchor, "MMMM yyyy"),
      };
    case "quarter": {
      const q = Math.floor(anchor.getMonth() / 3) + 1;
      return {
        from: iso(startOfQuarter(anchor)),
        to: iso(endOfQuarter(anchor)),
        label: `Q${q} ${format(anchor, "yyyy")}`,
      };
    }
    case "year":
      return {
        from: iso(startOfYear(anchor)),
        to: iso(endOfYear(anchor)),
        label: format(anchor, "yyyy"),
      };
    case "custom":
    default:
      return {
        from: customFrom || iso(startOfMonth(anchor)),
        to: customTo || iso(anchor),
        label: "Custom range",
      };
  }
}
