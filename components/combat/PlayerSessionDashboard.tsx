"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCombatSession } from "@/components/combat/useCombatSession";
import type { Combatant } from "@/components/combat/types";
import { conditionKey, normalizeConditions } from "@/lib/combatConditions";
import { cn } from "@/lib/utils";
import { createSupabaseClient } from "@/utils/supabase/client";

type Props = {
  sessionId: string;
  playerId: string;
};

const PLAYER_ROW_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };
const PLAYER_STAT_CHIP_BASE =
  "flex w-fit max-w-full shrink-0 items-baseline gap-x-0.5 rounded-md border border-border/80 bg-background/50 px-2 py-1.5 text-sm tabular-nums shadow-sm ring-1 ring-black/5 dark:bg-background/30 dark:ring-white/10 sm:py-1.5 sm:pl-2 sm:pr-1.5 sm:text-[0.9375rem]";

function clampTurnIndex(turnIndex: number, len: number): number {
  if (len <= 0) return -1;
  return Math.min(Math.max(0, turnIndex), len - 1);
}

function combatantsRotatedToCurrentTurn(combatants: Combatant[], currentTurnIndex: number): Combatant[] {
  if (combatants.length === 0) return [];
  const i = clampTurnIndex(currentTurnIndex, combatants.length);
  if (i < 0) return combatants;
  return [...combatants.slice(i), ...combatants.slice(0, i)];
}

export function PlayerSessionDashboard({ sessionId, playerId }: Props) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { session, combatants, loading, realtimeStatus } = useCombatSession(sessionId);
  const reduceMotion = useReducedMotion();
  const activeRowIndex = session ? clampTurnIndex(session.current_turn_index, combatants.length) : -1;
  const activeCombatant = activeRowIndex >= 0 ? combatants[activeRowIndex] : null;
  const [name, setName] = useState("");
  const [initiative, setInitiative] = useState(0);
  const [hpMax, setHpMax] = useState(10);
  const [ac, setAc] = useState(10);
  const [savingOwnerById, setSavingOwnerById] = useState<Record<string, boolean>>({});

  const combatantsInTurnOrder = useMemo(() => {
    if (!session || combatants.length === 0) return [];
    return combatantsRotatedToCurrentTurn(combatants, session.current_turn_index);
  }, [combatants, session]);

  const ownedCombatants = useMemo(
    () => combatants.filter((c) => c.owner_player_id === playerId),
    [combatants, playerId]
  );

  async function addCharacter(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!session || !trimmed) return;
    const initVal = Math.trunc(Number(initiative));
    const hpMaxVal = Math.max(1, Math.trunc(Number(hpMax)));
    const acVal = Math.max(0, Math.trunc(Number(ac)));
    const { error } = await supabase.from("combatants").insert({
      session_id: session.id,
      name: trimmed,
      initiative: Number.isFinite(initVal) ? initVal : 0,
      hp_current: hpMaxVal,
      hp_max: hpMaxVal,
      temp_hp: 0,
      armor_class: acVal,
      ac_visible_to_players: true,
      is_player: true,
      owner_player_id: playerId,
      auto_delete_exempt: true,
      resources: [],
      conditions: [],
      revealed_traits: [],
    });
    if (error) {
      console.error("Add player character:", error);
      return;
    }
    setName("");
    setInitiative(0);
    setHpMax(10);
    setAc(10);
  }

  async function updateOwnedCombatant(
    combatantId: string,
    patch: Partial<Pick<Combatant, "initiative" | "hp_current" | "hp_max" | "temp_hp" | "armor_class" | "name">>
  ) {
    setSavingOwnerById((prev) => ({ ...prev, [combatantId]: true }));
    const { error } = await supabase.from("combatants").update(patch).eq("id", combatantId).eq("owner_player_id", playerId);
    if (error) console.error("Update player combatant:", error);
    setSavingOwnerById((prev) => ({ ...prev, [combatantId]: false }));
  }

  if (!session) {
    return (
      <p className="text-sm text-muted-foreground">
        {loading ? "Loading combat…" : "Combat not found or you no longer have access."}
      </p>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <h2 className="mb-1 text-lg font-semibold text-foreground">Live Encounter: {session.name}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Round{" "}
        <motion.span
          key={session.current_round}
          className="font-medium text-foreground"
          initial={reduceMotion ? undefined : { opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          {session.current_round}
        </motion.span>
        {combatants.length > 0 ? (
          <>
            {" "}
            · Turn{" "}
            <motion.span
              key={`${activeRowIndex}-${combatants.length}`}
              className="font-medium text-foreground"
              initial={reduceMotion ? undefined : { opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              {activeRowIndex + 1} of {combatants.length}
            </motion.span>
            {activeCombatant ? (
              <>
                {" "}
                ·{" "}
                <motion.span
                  key={activeCombatant.id}
                  className="font-medium text-foreground"
                  initial={reduceMotion ? undefined : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                >
                  {activeCombatant.name}
                </motion.span>{" "}
                <span className="text-muted-foreground">(init {activeCombatant.initiative ?? 0})</span>
              </>
            ) : null}
          </>
        ) : null}
        <span
          className={cn(
            "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
            realtimeStatus === "live"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/80 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-300"
          )}
        >
          {realtimeStatus === "live" ? "Live" : "Reconnecting"}
        </span>
        {loading ? <span className="ml-2 text-xs">(syncing...)</span> : null}
      </p>
      <form className="rounded-md border border-border/70 bg-muted/20 p-3" onSubmit={addCharacter}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add your character</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-[12rem]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Character name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aelar" className="h-9" />
          </div>
          <div className="w-full sm:w-28">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Max HP</label>
            <Input type="number" min={1} value={hpMax} onChange={(e) => setHpMax(Number(e.target.value))} className="h-9" />
          </div>
          <div className="w-full sm:w-24">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Initiative</label>
            <Input type="number" value={initiative} onChange={(e) => setInitiative(Number(e.target.value))} className="h-9" />
          </div>
          <div className="w-full sm:w-24">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">AC</label>
            <Input type="number" min={0} value={ac} onChange={(e) => setAc(Number(e.target.value))} className="h-9" />
          </div>
          <Button type="submit" className="h-9">
            Add character
          </Button>
        </div>
      </form>

      {ownedCombatants.length > 0 ? (
        <div className="space-y-2 rounded-md border border-border/70 bg-muted/10 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your character controls</p>
          {ownedCombatants.map((c) => {
            const busy = savingOwnerById[c.id] ?? false;
            return (
              <div key={c.id} className="grid gap-2 md:grid-cols-6">
                <Input
                  value={c.name}
                  className="h-8 md:col-span-2"
                  onChange={(e) => void updateOwnedCombatant(c.id, { name: e.target.value })}
                  disabled={busy}
                />
                <Input
                  type="number"
                  value={c.initiative ?? 0}
                  className="h-8"
                  onChange={(e) => void updateOwnedCombatant(c.id, { initiative: Math.trunc(Number(e.target.value) || 0) })}
                  disabled={busy}
                />
                <Input
                  type="number"
                  value={c.hp_current}
                  className="h-8"
                  onChange={(e) => void updateOwnedCombatant(c.id, { hp_current: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
                  disabled={busy}
                />
                <Input
                  type="number"
                  value={c.hp_max}
                  className="h-8"
                  onChange={(e) => void updateOwnedCombatant(c.id, { hp_max: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })}
                  disabled={busy}
                />
                <Input
                  type="number"
                  value={c.armor_class}
                  className="h-8"
                  onChange={(e) => void updateOwnedCombatant(c.id, { armor_class: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
                  disabled={busy}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {combatantsInTurnOrder.map((combatant, index) => {
            const isCurrent = index === 0;
            const conditions = normalizeConditions(combatant.conditions);
            const isConcentrating = conditions.some((x) => conditionKey(x) === conditionKey("Concentrating"));
            const visibleConditions = conditions.filter((x) => conditionKey(x) !== conditionKey("Concentrating"));
            const showAc =
              combatant.owner_player_id === playerId || (!combatant.is_player && combatant.ac_visible_to_players);
            return (
              <motion.div
                key={combatant.id}
                layout
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0.12 } }
                    : { opacity: 0, scale: 0.98, transition: { duration: 0.18, ease: "easeIn" } }
                }
                transition={{
                  layout: reduceMotion ? { duration: 0 } : PLAYER_ROW_SPRING,
                  opacity: { duration: reduceMotion ? 0.01 : 0.18 },
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 sm:py-2.5",
                  isCurrent ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "bg-muted/25"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 sm:flex-nowrap sm:items-center sm:gap-x-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap sm:gap-x-4">
                    <div className={PLAYER_STAT_CHIP_BASE}>
                      <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">Init:</span>
                      <span className="ml-1 text-sm font-semibold">{combatant.initiative ?? 0}</span>
                    </div>
                    <div className="min-w-0 basis-full sm:basis-auto sm:w-32 sm:shrink-0">
                      <p className="text-sm font-semibold leading-tight tracking-tight text-foreground sm:truncate sm:text-[0.95rem]">
                        {combatant.name}
                      </p>
                    </div>
                    {showAc ? (
                      <div className={PLAYER_STAT_CHIP_BASE}>
                        <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">AC:</span>
                        <span className="ml-1 text-sm font-semibold">{combatant.armor_class}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {isConcentrating ? (
                      <span className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-xs font-semibold text-black dark:bg-zinc-100">
                        ◈
                      </span>
                    ) : null}
                  </div>
                </div>
                {visibleConditions.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {visibleConditions.map((c) => (
                      <span
                        key={conditionKey(c)}
                        className="rounded-md border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Card>
  );
}

