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
  const cleaned = text.replace(/```(?:json)?/gi, "");
  let rest = cleaned;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const found = firstJsonObject(rest);
    if (!found) return null;
    const estimate = estimateFromJson(found.json);
    if (estimate) return estimate;
    rest = rest.slice(found.end);
  }
  return null;
}

export const BROCHURE_NOTE = "Pip guessed from a known brochure.";

/** Typical usable tanks when the model will not return JSON. Not a measured fill. */
const BROCHURE: Array<{ name: string; tankLitres: number; efficiencyLPer100km: number }> = [
  { name: "qashqai", tankLitres: 55, efficiencyLPer100km: 6.4 },
  { name: "sportage", tankLitres: 54, efficiencyLPer100km: 6.5 },
  { name: "corolla", tankLitres: 50, efficiencyLPer100km: 5.1 },
  { name: "octavia", tankLitres: 50, efficiencyLPer100km: 5.2 },
  { name: "insignia", tankLitres: 62, efficiencyLPer100km: 5.8 },
  { name: "picanto", tankLitres: 35, efficiencyLPer100km: 5.0 },
  { name: "passat", tankLitres: 66, efficiencyLPer100km: 5.6 },
  { name: "tiguan", tankLitres: 58, efficiencyLPer100km: 6.6 },
  { name: "tucson", tankLitres: 54, efficiencyLPer100km: 6.5 },
  { name: "megane", tankLitres: 47, efficiencyLPer100km: 5.4 },
  { name: "fiesta", tankLitres: 42, efficiencyLPer100km: 5.3 },
  { name: "corsa", tankLitres: 44, efficiencyLPer100km: 5.4 },
  { name: "focus", tankLitres: 52, efficiencyLPer100km: 5.7 },
  { name: "civic", tankLitres: 46, efficiencyLPer100km: 5.6 },
  { name: "astra", tankLitres: 52, efficiencyLPer100km: 5.6 },
  { name: "yaris", tankLitres: 36, efficiencyLPer100km: 4.8 },
  { name: "clio", tankLitres: 42, efficiencyLPer100km: 5.3 },
  { name: "kuga", tankLitres: 54, efficiencyLPer100km: 6.2 },
  { name: "polo", tankLitres: 40, efficiencyLPer100km: 5.2 },
  { name: "golf", tankLitres: 50, efficiencyLPer100km: 5.8 },
  { name: "leon", tankLitres: 50, efficiencyLPer100km: 5.5 },
  { name: "ibiza", tankLitres: 40, efficiencyLPer100km: 5.2 },
  { name: "fabia", tankLitres: 40, efficiencyLPer100km: 5.1 },
  { name: "mokka", tankLitres: 44, efficiencyLPer100km: 5.8 },
  { name: "auris", tankLitres: 50, efficiencyLPer100km: 5.2 },
  { name: "swift", tankLitres: 37, efficiencyLPer100km: 4.9 },
  { name: "vitara", tankLitres: 47, efficiencyLPer100km: 5.8 },
  { name: "ceed", tankLitres: 50, efficiencyLPer100km: 5.5 },
  { name: "jazz", tankLitres: 40, efficiencyLPer100km: 5.0 },
  { name: "aygo", tankLitres: 35, efficiencyLPer100km: 4.8 },
  { name: "mini", tankLitres: 44, efficiencyLPer100km: 5.9 },
];

export function knownCarTank(query: string): CarTankEstimate | null {
  for (const car of BROCHURE) {
    if (!new RegExp(`\\b${car.name}\\b`, "i").test(query)) continue;
    return {
      tankLitres: car.tankLitres,
      efficiencyLPer100km: car.efficiencyLPer100km,
      confidence: "medium",
      notes: BROCHURE_NOTE,
    };
  }
  return null;
}

function firstJsonObject(text: string): { json: string; end: number } | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return { json: text.slice(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

function estimateFromJson(json: string): CarTankEstimate | null {
  const parsed = looseJson(json);
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

function looseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    try {
      return JSON.parse(json.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
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
