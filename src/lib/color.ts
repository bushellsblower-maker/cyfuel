export function priceColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const stops: Array<[number, number, number]> = [
    [30, 164, 106],
    [255, 196, 60],
    [214, 58, 74],
  ];
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = stops[index] ?? stops[0];
  const to = stops[index + 1] ?? stops[stops.length - 1];
  const mix = from.map((channel, i) => Math.round(channel + ((to[i] ?? channel) - channel) * local));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

export function scaleDomain(values: number[]): { lo: number; hi: number } | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))] ?? sorted[0];
  const lo = at(0.1);
  const hi = at(0.9);
  if (hi > lo) return { lo, hi };
  const first = sorted[0] ?? 0;
  const last = sorted[sorted.length - 1] ?? first + 1;
  return { lo: first, hi: last === first ? first + 1 : last };
}
