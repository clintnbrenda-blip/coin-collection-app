"use client";

export function GroupFilterSelect({
  groups,
  value,
}: {
  groups: { id: string; name: string }[];
  value: string;
}) {
  return (
    <select
      name="group"
      defaultValue={value}
      onChange={(e) => {
        const url = new URL(window.location.href);
        if (e.target.value) url.searchParams.set("group", e.target.value);
        else url.searchParams.delete("group");
        window.location.href = url.toString();
      }}
      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
    >
      <option value="">All groups</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
