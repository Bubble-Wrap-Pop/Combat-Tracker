/**
 * Live combat mutations against Supabase (`combatants` table).
 * Domain rules stay in combatHealth / combatResources; these functions wire them to Postgres.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase-database";
import type { Combatant } from "@/components/combat/types";
import { applyDamage, applyHeal } from "@/lib/combatHealth";
import {
  applyLongRestRecharge,
  applyShortRestRecharge,
  normalizeResources,
  type CombatResource,
} from "@/lib/combatResources";

export type SupabaseCombatClient = SupabaseClient<Database>;

function resourcesToJson(resources: CombatResource[]): Json {
  return resources as unknown as Json;
}

/**
 * Applies damage with temp HP absorbed first, then current HP (see {@link applyDamage}).
 * Does not delete minions at 0 HP — call {@link deleteCombatantById} when your UI rules require it.
 */
export async function applyDamageToCombatant(
  client: SupabaseCombatClient,
  combatant: Pick<Combatant, "id" | "hp_current" | "temp_hp">,
  damageAmount: number
): Promise<
  | { ok: true; hp_current: number; temp_hp: number }
  | { ok: false; error: string }
> {
  const { hp_current, temp_hp } = applyDamage(combatant.hp_current, combatant.temp_hp ?? 0, damageAmount);

  const { data, error } = await client
    .from("combatants")
    .update({ hp_current, temp_hp })
    .eq("id", combatant.id)
    .select("id");

  if (error) {
    console.error("applyDamageToCombatant:", error);
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "No row updated (RLS or missing combatant)." };
  }

  return { ok: true, hp_current, temp_hp };
}

export async function applyHealToCombatant(
  client: SupabaseCombatClient,
  combatant: Pick<Combatant, "id" | "hp_current" | "hp_max">,
  healAmount: number
): Promise<{ ok: true; hp_current: number } | { ok: false; error: string }> {
  const hp_current = applyHeal(combatant.hp_current, combatant.hp_max, healAmount);

  const { data, error } = await client
    .from("combatants")
    .update({ hp_current })
    .eq("id", combatant.id)
    .select("id");

  if (error) {
    console.error("applyHealToCombatant:", error);
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "No row updated (RLS or missing combatant)." };
  }

  return { ok: true, hp_current };
}

export async function deleteCombatantById(
  client: SupabaseCombatClient,
  combatantId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("combatants").delete().eq("id", combatantId);

  if (error) {
    console.error("deleteCombatantById:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Persists normalized resource rows to `combatants.resources`. */
export async function persistCombatantResources(
  client: SupabaseCombatClient,
  combatantId: string,
  resources: CombatResource[]
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeResources(resources);

  const { data, error } = await client
    .from("combatants")
    .update({ resources: resourcesToJson(normalized) })
    .eq("id", combatantId)
    .select("id");

  if (error) {
    console.error("persistCombatantResources:", error);
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "No row updated (RLS or missing combatant)." };
  }
  return { ok: true };
}

/** Sets each applicable resource slot to max per short-rest rules. */
export async function shortRestCombatantResources(
  client: SupabaseCombatClient,
  combatant: Pick<Combatant, "id" | "resources">,
  rawResources?: unknown
): Promise<{ ok: boolean; error?: string }> {
  const current = normalizeResources(rawResources ?? combatant.resources);
  const next = applyShortRestRecharge(current);
  return persistCombatantResources(client, combatant.id, next);
}

/** Sets each applicable resource slot to max per long-rest rules (includes short-rest slots). */
export async function longRestCombatantResources(
  client: SupabaseCombatClient,
  combatant: Pick<Combatant, "id" | "resources">,
  rawResources?: unknown
): Promise<{ ok: boolean; error?: string }> {
  const current = normalizeResources(rawResources ?? combatant.resources);
  const next = applyLongRestRecharge(current);
  return persistCombatantResources(client, combatant.id, next);
}

/**
 * Applies short rest rules to each listed combatant (usually all rows in one session).
 */
export async function shortRestSessionCombatantsResources(
  client: SupabaseCombatClient,
  combatants: Pick<Combatant, "id" | "resources">[]
): Promise<void> {
  for (const c of combatants) {
    await shortRestCombatantResources(client, c);
  }
}

/**
 * Applies long rest rules to each listed combatant.
 */
export async function longRestSessionCombatantsResources(
  client: SupabaseCombatClient,
  combatants: Pick<Combatant, "id" | "resources">[]
): Promise<void> {
  for (const c of combatants) {
    await longRestCombatantResources(client, c);
  }
}
