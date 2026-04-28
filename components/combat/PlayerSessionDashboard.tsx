"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCombatSession } from "@/components/combat/useCombatSession";
import type { Combatant } from "@/components/combat/types";
import { CombatantRow, rowBackgroundClass } from "@/components/combat/GMCombatDashboard";
import { cn } from "@/lib/utils";
import { createSupabaseClient } from "@/utils/supabase/client";

type Props = {
  sessionId: string;
  playerId: string;
};

const PLAYER_ROW_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

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
  const { session, combatants, loading, realtimeStatus, reload } = useCombatSession(sessionId);
  const reduceMotion = useReducedMotion();
  const activeRowIndex = session ? clampTurnIndex(session.current_turn_index, combatants.length) : -1;
  const activeCombatant = activeRowIndex >= 0 ? combatants[activeRowIndex] : null;
  const [name, setName] = useState("");
  const [initiative, setInitiative] = useState(0);
  const [hpMax, setHpMax] = useState(10);
  const [ac, setAc] = useState(10);
  const [addCharacterError, setAddCharacterError] = useState<string | null>(null);

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
    setAddCharacterError(null);
    const trimmed = name.trim();
    if (!session || !trimmed) return;
    if (ownedCombatants.length > 0) {
      setAddCharacterError("You can only create one player character in this session.");
      return;
    }
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
      setAddCharacterError(error.message);
      return;
    }
    setName("");
    setInitiative(0);
    setHpMax(10);
    setAc(10);
    void reload();
  }

  async function removeOwnedCharacter(combatantId: string, combatantName: string) {
    if (!globalThis.confirm(`Remove your character "${combatantName}" from this combat?`)) return;
    const { error } = await supabase.from("combatants").delete().eq("id", combatantId).eq("owner_player_id", playerId);
    if (error) {
      console.error("Remove player combatant:", error);
      return;
    }
    void reload();
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
      {ownedCombatants.length === 0 ? (
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
          {addCharacterError ? <p className="mt-2 text-xs text-destructive">{addCharacterError}</p> : null}
        </form>
      ) : null}

      <div className="grid gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {combatantsInTurnOrder.map((combatant, index) => {
            const isCurrent = index === 0;
            const isOwnedByPlayer = combatant.owner_player_id === playerId;
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
                className="w-full"
              >
                <CombatantRow
                  combatant={combatant}
                  activeTurnCombatantId={activeCombatant?.id ?? null}
                  isActiveTurn={isCurrent}
                  rowClassName={rowBackgroundClass(combatant)}
                  showTempHpControls={true}
                  autoDeleteMode="none"
                  reduceMotion={reduceMotion}
                  supabase={supabase}
                  reload={reload}
                  canEditCombatant={isOwnedByPlayer}
                  canRemoveCombatant={isOwnedByPlayer}
                  canReindexTurn={false}
                  showExtendedInfo={isOwnedByPlayer}
                  showHealthAndAc={isOwnedByPlayer}
                  onRemoveFromCombat={() => void removeOwnedCharacter(combatant.id, combatant.name)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Card>
  );
}

