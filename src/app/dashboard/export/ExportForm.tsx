"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { exportDataCsv, type ExportSection } from "./actions";

const SECTION_OPTIONS: { key: ExportSection; label: string }[] = [
  { key: "summary", label: "Summary (daily totals)" },
  { key: "machines", label: "Machine groups (quarters, dollars, turns)" },
  { key: "vending", label: "Vending (cash & coins)" },
  { key: "deposits", label: "Bank deposits" },
  { key: "checklist", label: "Checklist" },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ExportForm() {
  const router = useRouter();
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [sections, setSections] = useState<Set<ExportSection>>(
    new Set(SECTION_OPTIONS.map((s) => s.key))
  );
  const [fileType, setFileType] = useState<"csv" | "pdf">("csv");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSection(key: ExportSection) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!from || !to) {
      setError("Pick a start and end date.");
      return;
    }
    if (from > to) {
      setError("Start date must be before end date.");
      return;
    }
    if (sections.size === 0) {
      setError("Pick at least one type of data to include.");
      return;
    }

    if (fileType === "pdf") {
      const qs = new URLSearchParams({ from, to, sections: [...sections].join(",") });
      router.push(`/dashboard/export/report?${qs.toString()}`);
      return;
    }

    setPending(true);
    const result = await exportDataCsv(from, to, [...sections]);
    setPending(false);

    if (result.error || !result.csv) {
      setError(result.error ?? "Could not build the export.");
      return;
    }

    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename ?? "export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-neutral-700">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-neutral-700">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Include</p>
        <div className="space-y-2">
          {SECTION_OPTIONS.map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={sections.has(opt.key)}
                onChange={() => toggleSection(opt.key)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">File type</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="fileType"
              checked={fileType === "csv"}
              onChange={() => setFileType("csv")}
            />
            Excel (CSV)
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="fileType"
              checked={fileType === "pdf"}
              onChange={() => setFileType("pdf")}
            />
            PDF
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Building export…" : fileType === "pdf" ? "Open PDF report" : "Download CSV"}
      </button>
    </form>
  );
}
