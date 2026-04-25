/**
 * Normalizes `combatants.conditions` (jsonb) to a deduped list of non-empty strings.
 * Case-insensitive duplicates keep the first spelling.
 */
export function normalizeConditions(raw: unknown): string[] {
  let list: unknown[] = [];
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const parsed: unknown = JSON.parse(t);
      list = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      list = [raw];
    }
  } else {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const s = typeof item === "string" ? item.trim() : String(item ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Common 5e-style labels for quick-add in the GM combat UI. */
export const SUGGESTED_COMBAT_CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;

export function conditionKey(label: string): string {
  return label.trim().toLowerCase();
}

export function toggleSuggestedCondition(current: string[], label: string): string[] {
  const key = conditionKey(label);
  const has = current.some((c) => conditionKey(c) === key);
  if (has) return current.filter((c) => conditionKey(c) !== key);
  return [...current, label];
}
