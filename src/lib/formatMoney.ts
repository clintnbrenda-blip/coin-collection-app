/**
 * $1,234.56 — the standard way a dollar amount is displayed anywhere in the
 * app, with thousands separators like money is normally written.
 */
export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * $1,235 — a compact whole-dollar version (no cents) for tight spaces, like
 * the trend chart's y-axis labels.
 */
export function formatMoneyWhole(amount: number): string {
  return Math.round(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
