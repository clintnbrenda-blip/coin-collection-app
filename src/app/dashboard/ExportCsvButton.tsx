"use client";

import Papa from "papaparse";

interface LogRow {
  id: string;
  date: string;
  employee: string;
  daysSinceLast: number;
  totalIncome: number;
  avgTurns: number | null;
  incomePerDay: number | null;
}

export function ExportCsvButton({
  rows,
  filename,
}: {
  rows: LogRow[];
  filename: string;
}) {
  function handleExport() {
    const csv = Papa.unparse(
      rows.map((r) => ({
        Date: r.date,
        Employee: r.employee,
        "Days since last": r.daysSinceLast,
        "Total income": r.totalIncome.toFixed(2),
        "Avg turns": r.avgTurns !== null ? r.avgTurns.toFixed(1) : "",
        "Income/day": r.incomePerDay !== null ? r.incomePerDay.toFixed(2) : "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
    >
      Export CSV
    </button>
  );
}
