export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatUnit(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  } catch {
    return `${amount.toFixed(3)} ${currency}`;
  }
}

export function formatKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatLitres(litres: number): string {
  if (litres < 0.05) return "almost nothing";
  if (litres < 10) return `${litres.toFixed(1)} L`;
  return `${Math.round(litres)} L`;
}

export function currencyLabel(code: string): string {
  if (code === "standing") return "Where I'm standing";
  try {
    const name = new Intl.DisplayNames(undefined, { type: "currency" }).of(code);
    return name ? `${code} · ${name}` : code;
  } catch {
    return code;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}
