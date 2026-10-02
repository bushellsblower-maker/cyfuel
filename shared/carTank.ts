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
    if (!found) return parseProseTank(cleaned);
    const estimate = estimateFromJson(found.json);
    if (estimate) return estimate;
    rest = rest.slice(found.end);
  }
  return parseProseTank(cleaned);
}

/** Last pass when the model wrote litres in a sentence instead of JSON. */
export function parseProseTank(text: string): CarTankEstimate | null {
  const litre =
    text.match(/(\d{2}(?:\.\d)?)\s*(?:litres|liters|litre|liter)\b/i) ??
    text.match(/(\d{2}(?:\.\d)?)\s*L\b(?!\/)/i);
  if (!litre) return null;
  const tank = Number(litre[1]);
  if (!Number.isFinite(tank) || tank < 8 || tank > 200) return null;
  const effMatch = text.match(/(\d{1,2}(?:\.\d)?)\s*L\s*\/\s*100/i);
  let efficiency: number | null = null;
  if (effMatch) {
    const raw = Number(effMatch[1]);
    if (raw >= 1.5 && raw <= 30) efficiency = clamp(raw, EFF_MIN, EFF_MAX);
  }
  return {
    tankLitres: round1(clamp(tank, TANK_MIN, TANK_MAX)),
    efficiencyLPer100km: efficiency == null ? null : round1(efficiency),
    confidence: "low",
    notes: "Pip read a litre figure out of the brochure.",
  };
}

export const BROCHURE_NOTE = "Pip guessed from a known brochure.";

/** Typical usable tanks when the model will not return JSON. Not a measured fill. */
const BROCHURE: Array<{ keys: string[]; tankLitres: number; efficiencyLPer100km: number }> = [
  { keys: ["9-3", "9-5", "saab"], tankLitres: 61, efficiencyLPer100km: 8.5 },
  { keys: ["qashqai"], tankLitres: 55, efficiencyLPer100km: 6.4 },
  { keys: ["sportage"], tankLitres: 54, efficiencyLPer100km: 6.5 },
  { keys: ["corolla"], tankLitres: 50, efficiencyLPer100km: 5.1 },
  { keys: ["octavia"], tankLitres: 50, efficiencyLPer100km: 5.2 },
  { keys: ["insignia"], tankLitres: 62, efficiencyLPer100km: 5.8 },
  { keys: ["mondeo"], tankLitres: 62, efficiencyLPer100km: 5.9 },
  { keys: ["picanto"], tankLitres: 35, efficiencyLPer100km: 5.0 },
  { keys: ["passat"], tankLitres: 66, efficiencyLPer100km: 5.6 },
  { keys: ["tiguan"], tankLitres: 58, efficiencyLPer100km: 6.6 },
  { keys: ["tucson"], tankLitres: 54, efficiencyLPer100km: 6.5 },
  { keys: ["megane"], tankLitres: 47, efficiencyLPer100km: 5.4 },
  { keys: ["fiesta"], tankLitres: 42, efficiencyLPer100km: 5.3 },
  { keys: ["corsa"], tankLitres: 44, efficiencyLPer100km: 5.4 },
  { keys: ["focus"], tankLitres: 52, efficiencyLPer100km: 5.7 },
  { keys: ["civic"], tankLitres: 46, efficiencyLPer100km: 5.6 },
  { keys: ["astra"], tankLitres: 52, efficiencyLPer100km: 5.6 },
  { keys: ["yaris"], tankLitres: 36, efficiencyLPer100km: 4.8 },
  { keys: ["clio"], tankLitres: 42, efficiencyLPer100km: 5.3 },
  { keys: ["kuga"], tankLitres: 54, efficiencyLPer100km: 6.2 },
  { keys: ["polo"], tankLitres: 40, efficiencyLPer100km: 5.2 },
  { keys: ["golf"], tankLitres: 50, efficiencyLPer100km: 5.8 },
  { keys: ["leon"], tankLitres: 50, efficiencyLPer100km: 5.5 },
  { keys: ["ibiza"], tankLitres: 40, efficiencyLPer100km: 5.2 },
  { keys: ["fabia"], tankLitres: 40, efficiencyLPer100km: 5.1 },
  { keys: ["mokka"], tankLitres: 44, efficiencyLPer100km: 5.8 },
  { keys: ["auris"], tankLitres: 50, efficiencyLPer100km: 5.2 },
  { keys: ["swift"], tankLitres: 37, efficiencyLPer100km: 4.9 },
  { keys: ["vitara"], tankLitres: 47, efficiencyLPer100km: 5.8 },
  { keys: ["ceed"], tankLitres: 50, efficiencyLPer100km: 5.5 },
  { keys: ["jazz"], tankLitres: 40, efficiencyLPer100km: 5.0 },
  { keys: ["aygo"], tankLitres: 35, efficiencyLPer100km: 4.8 },
  { keys: ["mini"], tankLitres: 44, efficiencyLPer100km: 5.9 },
  { keys: ["a3"], tankLitres: 50, efficiencyLPer100km: 5.6 },
  { keys: ["a4"], tankLitres: 54, efficiencyLPer100km: 5.8 },
  { keys: ["3 series", "320d", "320i", "330i"], tankLitres: 59, efficiencyLPer100km: 6.4 },
  { keys: ["5 series"], tankLitres: 68, efficiencyLPer100km: 6.6 },
  { keys: ["1 series"], tankLitres: 52, efficiencyLPer100km: 6.0 },
  { keys: ["c-class", "c class", "c220"], tankLitres: 66, efficiencyLPer100km: 6.3 },
  { keys: ["e-class", "e class"], tankLitres: 66, efficiencyLPer100km: 6.2 },
  { keys: ["a-class", "a class"], tankLitres: 43, efficiencyLPer100km: 5.6 },
];

const BROCHURE_MATCHERS = BROCHURE.flatMap((car) => car.keys.map((key) => ({ key, car }))).sort(
  (a, b) => normalizeCarName(b.key).length - normalizeCarName(a.key).length,
);

/** Drop a leading model year so "2008 Saab" still finds Saab. */
export function normalizeCarName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(?:19|20)\d{2}\b/, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function knownCarTank(query: string): CarTankEstimate | null {
  const hay = ` ${normalizeCarName(query)} `;
  if (hay.trim() === "") return null;
  for (const { key, car } of BROCHURE_MATCHERS) {
    const needle = ` ${normalizeCarName(key)} `;
    if (needle.trim() === "" || !hay.includes(needle)) continue;
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
