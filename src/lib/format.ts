export function formatMzn(value: number): string {
  return `${Math.round(value).toLocaleString("pt-MZ")} MT`;
}

export function formatPct(value: number, fractionDigits = 1): string {
  if (!isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return `${headers.join(",")}\n${body}`;
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
