"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, MoreVertical, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCombatSession, type CombatSessionSnapshot } from "@/components/combat/useCombatSession";
import type { Combatant, CombatSession } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getNextTurnState } from "@/lib/combat";
import {
  applyDamage,
  applyHeal,
  applyTempHpOverride,
  applyTempHpRule,
  shouldDeleteMinionAtZero,
} from "@/lib/combatHealth";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Props = {
  sessionId: string;
};

const COMBAT_LIST_LAYOUT_SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.85 };

function clampTurnIndex(turnIndex: number, len: number): number {
  if (len <= 0) return -1;
  return Math.min(Math.max(0, turnIndex), len - 1);
}

/** Initiative order rotated so the current turn is first; completed turns sink toward the bottom. */
function combatantsRotatedToCurrentTurn(combatants: Combatant[], currentTurnIndex: number): Combatant[] {
  if (combatants.length === 0) return [];
  const i = clampTurnIndex(currentTurnIndex, combatants.length);
  if (i < 0) return combatants;
  return [...combatants.slice(i), ...combatants.slice(0, i)];
}

/** Shared shell with HP readout — flat stat strip inside a pill (compact width for Init / AC). */
const COMBAT_STAT_CHIP_BASE =
  "flex w-fit max-w-full shrink-0 items-baseline gap-x-0.5 rounded-md border border-border/80 bg-background/50 px-2 py-1.5 text-sm tabular-nums shadow-sm ring-1 ring-black/5 dark:bg-background/30 dark:ring-white/10 sm:py-1.5 sm:pl-2 sm:pr-1.5 sm:text-[0.9375rem]";

/** Primary numbers — same treatment as current HP in the readout. */
const COMBAT_STAT_VALUE = "font-semibold tabular-nums text-foreground";

/** Init / AC in edit mode: chip shell + small field (only while pencil edit is on). */
const COMBAT_STAT_CHIP_EDITABLE = cn(
  COMBAT_STAT_CHIP_BASE,
  "transition-[box-shadow,border-color] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20"
);

/** Row tint: temp HP overrides full-HP green; 0 HP is red when no temp. */
function rowBackgroundClass(c: Combatant): string {
  if ((c.temp_hp ?? 0) > 0) return "bg-sky-500/10";
  if (c.hp_max > 0 && c.hp_current >= c.hp_max) return "bg-emerald-500/10";
  if (c.hp_current === 0) return "bg-red-500/10";
  return "bg-muted/30";
}

export function GMCombatDashboard({ sessionId }: Props) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { session, combatants, loading, reload } = useCombatSession(sessionId);
  const reduceMotion = useReducedMotion();

  const [creatureName, setCreatureName] = useState("");
  const [maxHp, setMaxHp] = useState(10);
  const [addCount, setAddCount] = useState(1);
  const [addInitiative, setAddInitiative] = useState(0);
  const [addAc, setAddAc] = useState(10);

  const activeRowIndex = session ? clampTurnIndex(session.current_turn_index, combatants.length) : -1;
  const activeCombatant = activeRowIndex >= 0 ? combatants[activeRowIndex] : null;

  const combatantsInTurnOrder = useMemo(() => {
    if (!session || combatants.length === 0) return [];
    return combatantsRotatedToCurrentTurn(combatants, session.current_turn_index);
  }, [combatants, session]);

  const addCreatures = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!session?.id) return;
      const base = creatureName.trim();
      if (!base) return;
      const hp = Math.max(0, Math.floor(Number(maxHp)) || 0);
      const count = Math.max(1, Math.floor(Number(addCount)) || 1);
      const initRoll = Number.isFinite(Number(addInitiative)) ? Math.trunc(Number(addInitiative)) : 0;
      const acVal = Math.max(0, Math.floor(Number(addAc)) || 0);
      if (hp <= 0) return;

      const rows = Array.from({ length: count }, (_, i) => ({
        session_id: session.id,
        name: count > 1 ? `${base} (${i + 1})` : base,
        hp_max: hp,
        hp_current: hp,
        temp_hp: 0,
        initiative: initRoll,
        armor_class: acVal,
        is_player: false,
        conditions: [] as string[],
        revealed_traits: [] as string[],
      }));

      const { error } = await supabase.from("combatants").insert(rows);

      if (error) {
        console.error("Insert error:", error);
      } else {
        void reload();
      }
      setCreatureName("");
      setMaxHp(10);
      setAddCount(1);
      setAddAc(10);
    },
    [addAc, addCount, addInitiative, creatureName, maxHp, reload, session?.id, supabase]
  );

  async function advanceTurn() {
    if (!session || combatants.length === 0) return;
    const { nextTurnIndex, nextRound } = getNextTurnState(
      session.current_turn_index,
      session.current_round,
      combatants.length
    );
    await supabase
      .from("sessions")
      .update({ current_turn_index: nextTurnIndex, current_round: nextRound })
      .eq("id", session.id);
    void reload();
  }

  const resetToRoundOneTop = useCallback(async () => {
    if (!session) return;
    if (!globalThis.confirm("Reset to round 1 and the first turn in initiative order?")) return;
    const { error } = await supabase
      .from("sessions")
      .update({ current_round: 1, current_turn_index: 0 })
      .eq("id", session.id);
    if (error) {
      console.error("Reset session round:", error);
      return;
    }
    void reload();
  }, [reload, session, supabase]);

  const removeCombatantById = useCallback(
    async (combatantId: string) => {
      if (!session) return;
      const removedIndex = combatants.findIndex((c) => c.id === combatantId);
      if (removedIndex < 0) return;
      const removed = combatants[removedIndex];
      if (!globalThis.confirm(`Remove “${removed.name}” from this combat?`)) return;

      const oldLen = combatants.length;
      const a = clampTurnIndex(session.current_turn_index, oldLen);
      let newTurn = 0;
      if (oldLen > 1) {
        if (removedIndex < a) newTurn = a - 1;
        else if (removedIndex === a) newTurn = Math.min(a, oldLen - 2);
        else newTurn = a;
      }
      const newLen = oldLen - 1;
      const clampedTurn = newLen <= 0 ? 0 : Math.min(Math.max(0, newTurn), newLen - 1);

      const { error: delErr } = await supabase.from("combatants").delete().eq("id", removed.id);
      if (delErr) {
        console.error("Remove combatant:", delErr);
        return;
      }
      const { error: sessErr } = await supabase
        .from("sessions")
        .update({ current_turn_index: clampedTurn })
        .eq("id", session.id);
      if (sessErr) {
        console.error("Update turn after remove:", sessErr);
      }
      void reload();
    },
    [combatants, reload, session, supabase]
  );

  if (!session) {
    return (
      <p className="text-sm text-muted-foreground">
        {loading ? "Loading combat…" : "Combat not found or you no longer have access."}
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Turn order</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Round{" "}
                <motion.span
                  key={session.current_round}
                  className="font-medium text-foreground"
                  initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
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
                      initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
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
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 380, damping: 32 }
                          }
                        >
                          {activeCombatant.name}
                        </motion.span>{" "}
                        <span className="text-muted-foreground">
                          (init {activeCombatant.initiative ?? 0}, AC {activeCombatant.armor_class})
                        </span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <span> · Add combatants to track turns.</span>
                )}
                {loading ? <span className="ml-2 text-xs">(syncing…)</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => void resetToRoundOneTop()}>
                Reset
              </Button>
              <Button type="button" variant="default" disabled={combatants.length === 0} onClick={() => void advanceTurn()}>
                Next turn
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add creatures</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={(e) => void addCreatures(e)}
          >
            <div className="min-w-0 flex-1 sm:min-w-[12rem]">
              <label htmlFor="gm-creature-name" className="mb-1 block text-xs font-medium text-muted-foreground">
                Creature name
              </label>
              <Input
                id="gm-creature-name"
                value={creatureName}
                onChange={(e) => setCreatureName(e.target.value)}
                placeholder="Goblin"
              />
            </div>
            <div className="w-full sm:w-28">
              <label htmlFor="gm-max-hp" className="mb-1 block text-xs font-medium text-muted-foreground">
                Max HP
              </label>
              <Input
                id="gm-max-hp"
                type="number"
                min={1}
                value={maxHp}
                onChange={(e) => setMaxHp(Number(e.target.value))}
              />
            </div>
            <div className="w-full sm:w-24">
              <label htmlFor="gm-init" className="mb-1 block text-xs font-medium text-muted-foreground">
                Initiative
              </label>
              <Input
                id="gm-init"
                type="number"
                value={addInitiative}
                onChange={(e) => setAddInitiative(Number(e.target.value))}
              />
            </div>
            <div className="w-full sm:w-24">
              <label htmlFor="gm-ac" className="mb-1 block text-xs font-medium text-muted-foreground">
                AC
              </label>
              <Input
                id="gm-ac"
                type="number"
                min={0}
                value={addAc}
                onChange={(e) => setAddAc(Number(e.target.value))}
              />
            </div>
            <div className="w-full sm:w-24">
              <label htmlFor="gm-count" className="mb-1 block text-xs font-medium text-muted-foreground">
                Count
              </label>
              <Input
                id="gm-count"
                type="number"
                min={1}
                value={addCount}
                onChange={(e) => setAddCount(Number(e.target.value))}
              />
            </div>
            <Button type="submit">Add creatures</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Combatants</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {combatants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No combatants yet.</p>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {combatantsInTurnOrder.map((combatant, index) => (
                <motion.div
                  key={combatant.id}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0.12 } }
                      : { opacity: 0, scale: 0.98, y: -8, transition: { duration: 0.2, ease: "easeIn" } }
                  }
                  transition={{
                    layout: reduceMotion ? { duration: 0 } : COMBAT_LIST_LAYOUT_SPRING,
                    opacity: { duration: reduceMotion ? 0.01 : 0.2 },
                    y: { duration: reduceMotion ? 0.01 : 0.22 },
                  }}
                  style={{ originX: 0.5, originY: 0 }}
                >
                  <CombatantRow
                    combatant={combatant}
                    activeTurnCombatantId={activeCombatant?.id ?? null}
                    isActiveTurn={index === 0}
                    rowClassName={rowBackgroundClass(combatant)}
                    supabase={supabase}
                    reload={reload}
                    onRemoveFromCombat={() => void removeCombatantById(combatant.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function enterToCommit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.blur();
  }
}

function CombatantRow({
  combatant,
  activeTurnCombatantId,
  isActiveTurn,
  rowClassName,
  supabase,
  reload,
  onRemoveFromCombat,
}: {
  combatant: Combatant;
  activeTurnCombatantId: string | null;
  isActiveTurn: boolean;
  rowClassName: string;
  supabase: ReturnType<typeof createSupabaseClient>;
  reload: () => Promise<CombatSessionSnapshot | undefined>;
  onRemoveFromCombat: () => void;
}) {
  const [damage, setDamage] = useState("");
  const [heal, setHeal] = useState("");
  const [temp, setTemp] = useState("");
  const [tempHpExact, setTempHpExact] = useState(false);

  const [editingBasics, setEditingBasics] = useState(false);
  const [editName, setEditName] = useState("");
  const [editInit, setEditInit] = useState("");
  const [editAc, setEditAc] = useState("");
  const [editHpCurrent, setEditHpCurrent] = useState("");
  const [editHpMax, setEditHpMax] = useState("");

  useEffect(() => {
    setEditingBasics(false);
  }, [combatant.id]);

  const cancelBasicsEdit = useCallback(() => {
    setEditingBasics(false);
  }, []);

  useEffect(() => {
    if (!editingBasics) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") cancelBasicsEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingBasics, cancelBasicsEdit]);

  const beginBasicsEdit = () => {
    setEditingBasics(true);
    setEditName(combatant.name);
    setEditInit(combatant.initiative == null ? "" : String(combatant.initiative));
    setEditAc(String(combatant.armor_class));
    setEditHpCurrent(String(combatant.hp_current));
    setEditHpMax(String(combatant.hp_max));
  };

  const applyDamageAction = async (raw: string) => {
    const t = raw.trim();
    if (t === "") return;
    const amt = Math.max(0, Math.floor(Number(t)) || 0);
    if (amt <= 0) {
      setDamage("");
      return;
    }
    const { hp_current, temp_hp } = applyDamage(combatant.hp_current, combatant.temp_hp ?? 0, amt);
    if (shouldDeleteMinionAtZero(hp_current, combatant.name)) {
      const { error } = await supabase.from("combatants").delete().eq("id", combatant.id);
      if (error) {
        console.error("Delete combatant:", error);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("combatants")
        .update({ hp_current, temp_hp })
        .eq("id", combatant.id)
        .select("id");
      if (error) {
        console.error("Update combatant HP:", error);
        return;
      }
      if (!data?.length) {
        console.error("Update combatant HP: no row updated (check session access / RLS).");
        return;
      }
    }
    setDamage("");
    void reload();
  };

  const applyHealAction = async (raw: string) => {
    const t = raw.trim();
    if (t === "") return;
    const amt = Math.max(0, Math.floor(Number(t)) || 0);
    if (amt <= 0) {
      setHeal("");
      return;
    }
    const hp_current = applyHeal(combatant.hp_current, combatant.hp_max, amt);
    const { data, error } = await supabase
      .from("combatants")
      .update({ hp_current })
      .eq("id", combatant.id)
      .select("id");
    if (error) {
      console.error("Update combatant heal:", error);
      return;
    }
    if (!data?.length) {
      console.error("Update combatant heal: no row updated (check session access / RLS).");
      return;
    }
    setHeal("");
    void reload();
  };

  const saveBasicsEdits = async () => {
    const name = editName.trim();
    if (!name) {
      console.error("Name cannot be empty.");
      return;
    }
    const initTrim = editInit.trim();
    const initiativeVal = initTrim === "" || initTrim === "—" ? 0 : Math.trunc(Number(initTrim));
    if (!Number.isFinite(initiativeVal)) {
      console.error("Invalid initiative.");
      return;
    }
    const acParsed = Number(editAc.trim());
    if (!Number.isFinite(acParsed)) {
      console.error("Invalid AC.");
      return;
    }
    const acVal = Math.max(0, Math.floor(acParsed));
    const hpCur = Math.max(0, Math.floor(Number(editHpCurrent)) || 0);
    const hpMax = Math.max(1, Math.floor(Number(editHpMax)) || 1);
    const hpCurrent = Math.min(hpCur, hpMax);

    const updates: Record<string, string | number> = {};
    if (name !== combatant.name) updates.name = name;

    const prevInit = combatant.initiative;
    const initChanged = prevInit == null ? initiativeVal !== 0 : initiativeVal !== prevInit;
    if (initChanged) updates.initiative = initiativeVal;
    const initiativeChanged = initChanged;

    if (acVal !== combatant.armor_class) updates.armor_class = acVal;
    if (hpCurrent !== combatant.hp_current) updates.hp_current = hpCurrent;
    if (hpMax !== combatant.hp_max) updates.hp_max = hpMax;

    if (Object.keys(updates).length === 0) {
      setEditingBasics(false);
      return;
    }

    const { data, error } = await supabase.from("combatants").update(updates).eq("id", combatant.id).select("id");
    if (error) {
      console.error("Update combatant basics:", error);
      return;
    }
    if (!data?.length) {
      console.error("Update combatant basics: no row updated (check session access / RLS).");
      return;
    }

    const snap = await reload();
    if (initiativeChanged && snap?.session && activeTurnCombatantId) {
      const idx = snap.combatants.findIndex((c) => c.id === activeTurnCombatantId);
      if (idx >= 0 && idx !== snap.session.current_turn_index) {
        await supabase.from("sessions").update({ current_turn_index: idx }).eq("id", snap.session.id);
      }
    }
    setEditingBasics(false);
    void reload();
  };

  const applyTempAction = async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return;
    const amt = Math.max(0, Math.floor(Number(trimmed)) || 0);
    const temp_hp = tempHpExact
      ? applyTempHpOverride(amt)
      : applyTempHpRule(combatant.temp_hp ?? 0, amt);
    if (temp_hp === (combatant.temp_hp ?? 0)) {
      setTemp("");
      return;
    }
    const { data, error } = await supabase
      .from("combatants")
      .update({ temp_hp })
      .eq("id", combatant.id)
      .select("id");
    if (error) {
      console.error("Update combatant temp HP:", error);
      return;
    }
    if (!data?.length) {
      console.error("Update combatant temp HP: no row updated (check session access / RLS).");
      return;
    }
    setTemp("");
    void reload();
  };

  /** Slightly narrower than before — horizontal only; height matches default inputs. */
  const fieldClass = "w-[3.75rem] shrink-0 sm:w-[4.25rem]";
  const tempHpPool = combatant.temp_hp ?? 0;
  const initRead = combatant.initiative == null ? "—" : String(combatant.initiative);
  const chipStatInputClass =
    "ml-1 h-8 w-[4rem] shrink-0 border-0 bg-transparent px-1 py-0 text-sm font-semibold tabular-nums text-foreground shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-primary/35 sm:w-[4.25rem]";

  return (
    <div
      className={cn(
        "motion-safe:transition-[box-shadow,background-color] motion-safe:duration-300 motion-safe:ease-out flex flex-row flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border p-3 sm:flex-nowrap sm:gap-x-4 sm:py-2.5",
        rowClassName,
        isActiveTurn && "ring-2 ring-primary ring-offset-2 ring-offset-background z-[1]"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 sm:gap-x-4">
        {editingBasics ? (
          <>
            <div className={COMBAT_STAT_CHIP_EDITABLE} aria-label={`Edit initiative for ${combatant.name}`}>
              <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">Init:</span>
              <Input
                type="text"
                inputMode="numeric"
                value={editInit}
                onChange={(e) => setEditInit(e.target.value)}
                className={chipStatInputClass}
              />
            </div>
            <div className="min-w-0 max-w-[11rem] shrink sm:max-w-[13rem]">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 text-sm"
                aria-label="Creature name"
              />
            </div>
            <div
              className={COMBAT_STAT_CHIP_EDITABLE}
              aria-label={`Edit hit points for ${combatant.name}`}
            >
              <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">HP:</span>
              <Input
                type="text"
                inputMode="numeric"
                value={editHpCurrent}
                onChange={(e) => setEditHpCurrent(e.target.value)}
                className={chipStatInputClass}
                aria-label="Current HP"
              />
              {tempHpPool > 0 ? (
                <span className={cn(COMBAT_STAT_VALUE, "text-sm text-sky-600 dark:text-sky-400")}>+{tempHpPool}</span>
              ) : null}
              <span className="text-muted-foreground">/</span>
              <Input
                type="text"
                inputMode="numeric"
                value={editHpMax}
                onChange={(e) => setEditHpMax(e.target.value)}
                className={cn(chipStatInputClass, "ml-0.5")}
                aria-label="Max HP"
              />
            </div>
            <div className={COMBAT_STAT_CHIP_EDITABLE} aria-label={`Edit AC for ${combatant.name}`}>
              <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">AC:</span>
              <Input
                type="text"
                inputMode="numeric"
                value={editAc}
                onChange={(e) => setEditAc(e.target.value)}
                className={chipStatInputClass}
              />
            </div>
          </>
        ) : (
          <>
            <div className={COMBAT_STAT_CHIP_BASE} aria-label={`Initiative for ${combatant.name}`}>
              <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">Init:</span>
              <span className={cn(COMBAT_STAT_VALUE, "ml-1 text-sm")}>{initRead}</span>
            </div>
            <div className="w-28 shrink-0 sm:w-32">
              <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-[0.95rem]">
                {combatant.name}
              </p>
            </div>
            <div
              className={COMBAT_STAT_CHIP_BASE}
              aria-label={`Hit points ${combatant.hp_current} of ${combatant.hp_max}${tempHpPool > 0 ? `, ${tempHpPool} temporary` : ""}`}
            >
              <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">HP:</span>
              <span className={cn(COMBAT_STAT_VALUE, "ml-1 text-sm")}>{combatant.hp_current}</span>
              {tempHpPool > 0 ? (
                <span className={cn(COMBAT_STAT_VALUE, "text-sm text-sky-600 dark:text-sky-400")}>+{tempHpPool}</span>
              ) : null}
              <span className="text-muted-foreground">
                {" "}
                / {combatant.hp_max}
              </span>
            </div>
            <div className={COMBAT_STAT_CHIP_BASE} aria-label={`Armor class for ${combatant.name}`}>
              <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">AC:</span>
              <span className={cn(COMBAT_STAT_VALUE, "ml-1 text-sm")}>{combatant.armor_class}</span>
            </div>
          </>
        )}
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:flex-nowrap sm:gap-x-3">
        <div className="flex flex-wrap items-end justify-end gap-x-2 gap-y-1 sm:flex-nowrap sm:gap-x-3">
          <div className={fieldClass}>
          <label className="mb-1 block text-xs text-muted-foreground">Damage</label>
          <Input
            type="text"
            inputMode="numeric"
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
            onBlur={(e) => void applyDamageAction(e.target.value)}
            onKeyDown={enterToCommit}
            placeholder="—"
            disabled={editingBasics}
            className="h-9 px-2 text-sm"
          />
          </div>
          <div className={fieldClass}>
          <label className="mb-1 block text-xs text-muted-foreground">Heal</label>
          <Input
            type="text"
            inputMode="numeric"
            value={heal}
            onChange={(e) => setHeal(e.target.value)}
            onBlur={(e) => void applyHealAction(e.target.value)}
            onKeyDown={enterToCommit}
            placeholder="—"
            disabled={editingBasics}
            className="h-9 px-2 text-sm"
          />
          </div>
          <div className="w-[5.25rem] shrink-0 sm:w-[5.75rem]">
          <div className="mb-1 flex items-center justify-between gap-1">
            <span className="text-xs text-muted-foreground">Temp HP</span>
            <label
              className="flex cursor-pointer items-center gap-1 text-[0.65rem] leading-none text-muted-foreground"
              title="Set temp HP to this number even if lower than the current pool"
            >
              <input
                type="checkbox"
                checked={tempHpExact}
                disabled={editingBasics}
                onChange={(e) => setTempHpExact(e.target.checked)}
                className="border-input text-primary focus-visible:ring-ring h-3 w-3 shrink-0 rounded border accent-primary focus-visible:outline-none focus-visible:ring-1"
              />
              <span className="select-none">Exact</span>
            </label>
          </div>
          <Input
            type="text"
            inputMode="numeric"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            onBlur={(e) => void applyTempAction(e.target.value)}
            onKeyDown={enterToCommit}
            placeholder="—"
            disabled={editingBasics}
            className="h-9 px-2 text-sm"
          />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {editingBasics ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0"
                aria-label="Save name, initiative, AC, and HP"
                onClick={() => void saveBasicsEdits()}
              >
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0"
                aria-label="Cancel editing"
                onClick={cancelBasicsEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0"
              aria-label="Edit name, initiative, AC, and HP"
              onClick={beginBasicsEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0"
              aria-label={`Options for ${combatant.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="border-border bg-background text-foreground z-50 min-w-[11rem] overflow-hidden rounded-md border p-1 shadow-md"
              sideOffset={4}
              align="end"
            >
              <DropdownMenu.Item
                className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none"
                onSelect={() => {
                  onRemoveFromCombat();
                }}
              >
                Remove from combat
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
