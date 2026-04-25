export type ResourceRechargePolicy = "short_rest" | "long_rest" | "manual";

export type CombatResource = {
  id: string;
  name: string;
  current: number;
  max: number;
  recharge: ResourceRechargePolicy;
};

const VALID_RECHARGE = new Set<ResourceRechargePolicy>(["short_rest", "long_rest", "manual"]);

function toInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function normalizeName(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "");
  return raw.trim();
}

function normalizeRecharge(value: unknown): ResourceRechargePolicy {
  if (typeof value === "string" && VALID_RECHARGE.has(value as ResourceRechargePolicy)) {
    return value as ResourceRechargePolicy;
  }
  return "manual";
}

function normalizeResource(candidate: unknown): CombatResource | null {
  if (!candidate || typeof candidate !== "object") return null;
  const rec = candidate as Record<string, unknown>;
  const id = normalizeName(rec.id);
  const name = normalizeName(rec.name);
  if (!id || !name) return null;

  const max = Math.max(0, toInt(rec.max));
  const current = Math.min(max, Math.max(0, toInt(rec.current)));
  const recharge = normalizeRecharge(rec.recharge);

  return { id, name, current, max, recharge };
}

/** Normalizes `combatants.resources` (jsonb) to a valid list with unique ids. */
export function normalizeResources(raw: unknown): CombatResource[] {
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
      return [];
    }
  } else {
    return [];
  }

  const seen = new Set<string>();
  const out: CombatResource[] = [];
  for (const item of list) {
    const normalized = normalizeResource(item);
    if (!normalized) continue;
    if (seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    out.push(normalized);
  }
  return out;
}

/** Add a new resource or update an existing one by id. */
export function upsertResource(current: CombatResource[], incoming: CombatResource): CombatResource[] {
  const normalizedIncoming = normalizeResource(incoming);
  if (!normalizedIncoming) return current;
  const next = [...current];
  const idx = next.findIndex((r) => r.id === normalizedIncoming.id);
  if (idx >= 0) next[idx] = normalizedIncoming;
  else next.push(normalizedIncoming);
  return next;
}

export function removeResource(current: CombatResource[], id: string): CombatResource[] {
  return current.filter((r) => r.id !== id);
}

/** Short rest recharges only resources configured for short rest. */
export function applyShortRestRecharge(current: CombatResource[]): CombatResource[] {
  return current.map((r) => {
    if (r.recharge !== "short_rest") return r;
    return { ...r, current: r.max };
  });
}

/** Long rest recharges both long-rest and short-rest resources. */
export function applyLongRestRecharge(current: CombatResource[]): CombatResource[] {
  return current.map((r) => {
    if (r.recharge === "manual") return r;
    return { ...r, current: r.max };
  });
}

