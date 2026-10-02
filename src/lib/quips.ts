import { formatKm, formatMoney } from "./format";
import { winner, type RankedStation } from "../../shared/rank";

export type Mood = "wave" | "pump" | "bargain" | "clever" | "ouch" | "hunt";

export function mascotLine(input: {
  booting: boolean;
  hasOrigin: boolean;
  loading: boolean;
  ranked: RankedStation[];
  homeName: string | null;
  compareCurrency: string;
  fuelLabel: string;
}): { mood: Mood; line: string } {
  if (input.booting) {
    return { mood: "pump", line: "Hold my nozzle. I'm inhaling a planet's worth of price lists." };
  }
  if (!input.hasOrigin) {
    return { mood: "wave", line: "Pop me somewhere. I promise not to judge the car." };
  }
  if (input.loading) {
    return { mood: "pump", line: "Pumping nearby prices… the hose is doing its best." };
  }
  if (!input.ranked.length) {
    const where = input.homeName ? ` in ${input.homeName}` : "";
    return {
      mood: "hunt",
      line: `No open ${input.fuelLabel.toLowerCase()} pumps${where}. The country colour is an average — we're still hunting local nozzles.`,
    };
  }
  const best = winner(input.ranked, "efficient");
  const cheap = winner(input.ranked, "cheapest");
  const near = winner(input.ranked, "nearest");
  if (!best || !cheap || !near) {
    return { mood: "wave", line: "Ranked by the fill, plus the sip you burn getting there." };
  }
  if (best.id === cheap.id && best.id === near.id) {
    return { mood: "bargain", line: "Closest, cheapest, and cleverest. I am suspiciously calm." };
  }
  if (best.id !== cheap.id) {
    const extra = cheap.total - best.total;
    const further = Math.abs(cheap.distanceKm - best.distanceKm);
    if (extra > 0.05) {
      return {
        mood: "clever",
        line: `The cheap sticker is ${formatKm(further)} off and ${formatMoney(extra, input.compareCurrency)} more once the drive counts.`,
      };
    }
  }
  if (best.id !== near.id && best.total + 0.05 < near.total) {
    return {
      mood: "clever",
      line: `A nearer pump exists, but it costs ${formatMoney(near.total - best.total, input.compareCurrency)} more all-in. Rude.`,
    };
  }
  const pricey = best.unitPrice > median(input.ranked.map((row) => row.unitPrice)) * 1.08;
  if (pricey) {
    return { mood: "ouch", line: "These pumps look very pleased with themselves. The clever one is merely the least cheeky." };
  }
  return { mood: "bargain", line: "This is the efficient fill: tank plus the fuel you spend arriving." };
}

export function cardQuip(row: RankedStation, ranked: RankedStation[]): string {
  if (row.badges.includes("efficient") && row.badges.includes("cheapest") && row.badges.includes("nearest")) {
    return "I'd fill here and then buy a small cake.";
  }
  if (row.badges.includes("efficient")) return "The clever glug. Your future self sends thanks.";
  if (row.badges.includes("cheapest") && !row.badges.includes("efficient")) {
    return "Tempting sticker. The drive eats the saving.";
  }
  if (row.badges.includes("nearest") && !row.badges.includes("efficient")) {
    return "Handy. Your wallet has filed a small complaint.";
  }
  const best = winner(ranked, "efficient");
  if (best && row.total > best.total * 1.08) return "A scenic way to spend more.";
  return "A perfectly ordinary nozzle. No notes.";
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
