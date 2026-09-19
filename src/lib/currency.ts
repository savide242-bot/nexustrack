// Live FX rates (base USD), cached in localStorage for 6h.
const CACHE_KEY = "nx_fx_rates_v1";
const TTL_MS = 6 * 60 * 60 * 1000;

const FALLBACK: Record<string, number> = {
  USD: 1, MZN: 63.9, ZAR: 18.2, BRL: 5.4, EUR: 0.92, GBP: 0.78,
  MXN: 17.5, AOA: 910, NGN: 1500, KES: 129, GHS: 15.5, INR: 83.5,
  CAD: 1.36, AUD: 1.52, ARS: 950, CLP: 950, COP: 4000, PEN: 3.75,
};

export const CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: "USD", label: "Dólar americano", symbol: "$" },
  { code: "ZAR", label: "Rand sul-africano", symbol: "R" },
  { code: "MZN", label: "Metical", symbol: "MT" },
  { code: "BRL", label: "Real brasileiro", symbol: "R$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "Libra", symbol: "£" },
  { code: "MXN", label: "Peso mexicano", symbol: "$" },
  { code: "AOA", label: "Kwanza", symbol: "Kz" },
  { code: "NGN", label: "Naira", symbol: "₦" },
  { code: "KES", label: "Xelim queniano", symbol: "KSh" },
  { code: "GHS", label: "Cedi", symbol: "₵" },
  { code: "INR", label: "Rupia", symbol: "₹" },
  { code: "CAD", label: "Dólar canadiano", symbol: "C$" },
  { code: "AUD", label: "Dólar australiano", symbol: "A$" },
];

export type Rates = Record<string, number>;

export async function fetchRates(): Promise<Rates> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { at: number; rates: Rates };
      if (Date.now() - cached.at < TTL_MS && cached.rates?.USD) return cached.rates;
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data?.rates?.MZN) {
      const rates: Rates = { ...data.rates, USD: 1 };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rates }));
      return rates;
    }
  } catch { /* ignore */ }

  return FALLBACK;
}

/** Convert an amount between currencies using USD-based rates. */
export function convert(amount: number, from: string, to: string, rates: Rates): number {
  if (!isFinite(amount)) return 0;
  if (from === to) return amount;
  const rFrom = rates[from] ?? FALLBACK[from];
  const rTo = rates[to] ?? FALLBACK[to];
  if (!rFrom || !rTo) return amount;
  return (amount / rFrom) * rTo;
}

export function symbolOf(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** Format an amount already expressed in `code`. */
export function formatCurrency(amount: number, code: string): string {
  const value = Math.abs(amount) >= 1000
    ? Math.round(amount).toLocaleString("pt-PT")
    : amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = symbolOf(code);
  return code === "MZN" ? `${value} MT` : `${sym} ${value}`;
}

export function rateBetween(from: string, to: string, rates: Rates): number {
  return convert(1, from, to, rates);
}
