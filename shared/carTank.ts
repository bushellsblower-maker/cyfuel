export type CarConfidence = "high" | "medium" | "low";

export type CarTankEstimate = {
  tankLitres: number;
  efficiencyLPer100km: number | null;
  confidence: CarConfidence;
  notes: string;
};

const TANK_MIN = 10;
const TANK_MAX = 150;
const EFF_MIN = 2;
const EFF_MAX = 25;

/** Pull a tank estimate out of model text. Returns null when the JSON is missing or absurd. */
export function parseCarTank(text: string): CarTankEstimate | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const tank = asNumber(record.tankLitres);
  if (tank == null || tank < 8 || tank > 200) return null;
  let efficiency: number | null = null;
  if (record.efficiencyLPer100km != null) {
    const raw = asNumber(record.efficiencyLPer100km);
    if (raw != null && raw >= 1.5 && raw <= 30) efficiency = clamp(raw, EFF_MIN, EFF_MAX);
  }
  const confidence: CarConfidence =
    record.confidence === "high" || record.confidence === "low" ? record.confidence : "medium";
  const notes = typeof record.notes === "string" ? record.notes.replace(/\s+/g, " ").trim().slice(0, 160) : "";
  return {
    tankLitres: round1(clamp(tank, TANK_MIN, TANK_MAX)),
    efficiencyLPer100km: efficiency == null ? null : round1(efficiency),
    confidence,
    notes,
  };
}

export function cleanCarQuery(value: string): string {
  return value
    .replace(/[^\p{L}\p{N} .,'’+/-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
