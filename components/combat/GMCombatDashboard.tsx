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
import { Check, MoreVertical, Pencil, Tag, X } from "lucide-react";
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
import {
  conditionKey,
  normalizeConditions,
  SUGGESTED_COMBAT_CONDITIONS,
  toggleSuggestedCondition,
} from "@/lib/combatConditions";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Props = {
  sessionId: string;
};

type CombatToolsTabId = "turn-order" | "add-creatures" | "settings";

const COMBAT_TOOLS_TABS: { id: CombatToolsTabId; label: string }[] = [
  { id: "turn-order", label: "Turn order" },
  { id: "add-creatures", label: "Add creatures" },
  { id: "settings", label: "Settings" },
];

const SHOW_TEMP_HP_STORAGE_KEY = "combat-tracker-gm-show-temp-hp";

const COMBAT_LIST_LAYOUT_SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.85 };

const TAB_SPRING = { type: "spring" as const, stiffness: 400, damping: 34 };

function getTabPanelMotionProps(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.08 } },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const } },
    transition: {
      opacity: { duration: 0.22 },
      y: TAB_SPRING,
    },
  };
}

function getHeaderActionsMotionProps(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.08 } },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const } },
    transition: { opacity: { duration: 0.2 }, x: TAB_SPRING },
  };
}

function getBasicsStripMotionProps(reduceMotion: boolean | null, stripMode: "read" | "edit") {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.08 } },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, x: stripMode === "edit" ? -12 : 12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: stripMode === "edit" ? 12 : -12, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] as const } },
    transition: { opacity: { duration: 0.2 }, x: TAB_SPRING },
  };
}

function getTempHpColumnMotionProps(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.08 } },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.92, x: 14 },
    animate: { opacity: 1, scale: 1, x: 0 },
    exit: { opacity: 0, scale: 0.94, x: 10, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] as const } },
    transition: { opacity: { duration: 0.18 }, scale: { duration: 0.2 }, x: TAB_SPRING },
  };
}

function getDropdownSurfaceMotionProps(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.97, y: -6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
  };
}

const segmentTabClass = (active: boolean) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
  );

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
  const [combatToolsTab, setCombatToolsTab] = useState<CombatToolsTabId>("turn-order");
  const [showTempHpControls, setShowTempHpControls] = useState(true);

  useEffect(() => {
    try {
      const raw = globalThis.localStorage?.getItem(SHOW_TEMP_HP_STORAGE_KEY);
      if (raw === "0" || raw === "false") setShowTempHpControls(false);
    } catch {
      // ignore
    }
  }, []);

  const persistShowTempHpControls = useCallback((next: boolean) => {
    setShowTempHpControls(next);
    try {
      globalThis.localStorage?.setItem(SHOW_TEMP_HP_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

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
        setCombatToolsTab("turn-order");
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
    <motion.div
      layout
      className="grid gap-4"
      transition={{ layout: reduceMotion ? { duration: 0 } : TAB_SPRING }}
    >
      <Card className="gap-0">
        <CardHeader className="border-0 space-y-0 px-4 pb-3 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div
              role="tablist"
              aria-label="Combat tools"
              className="bg-muted/50 flex w-full max-w-full flex-wrap gap-0.5 rounded-lg p-1 sm:w-auto"
            >
              {COMBAT_TOOLS_TABS.map((tab) => (
                <motion.button
                  key={tab.id}
                  layout
                  type="button"
                  role="tab"
                  aria-selected={combatToolsTab === tab.id}
                  id={`combat-tab-${tab.id}`}
                  aria-controls={`combat-tabpanel-${tab.id}`}
                  className={segmentTabClass(combatToolsTab === tab.id)}
                  onClick={() => setCombatToolsTab(tab.id)}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  transition={{
                    layout: reduceMotion ? { duration: 0 } : TAB_SPRING,
                  }}
                >
                  {tab.label}
                </motion.button>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {combatToolsTab === "turn-order" ? (
                <motion.div
                  key="turn-header-actions"
                  className="flex shrink-0 flex-wrap items-center gap-2"
                  {...getHeaderActionsMotionProps(reduceMotion)}
                >
                  <Button type="button" variant="outline" onClick={() => void resetToRoundOneTop()}>
                    Reset
                  </Button>
                  <Button type="button" variant="default" disabled={combatants.length === 0} onClick={() => void advanceTurn()}>
                    Next turn
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </CardHeader>

        <CardContent className="relative min-h-[3.25rem] overflow-hidden pb-4 pt-2">
          <AnimatePresence mode="wait" initial={false}>
            {combatToolsTab === "turn-order" ? (
              <motion.div
                key="turn-order"
                id="combat-tabpanel-turn-order"
                role="tabpanel"
                aria-labelledby="combat-tab-turn-order"
                className="w-full"
                {...getTabPanelMotionProps(reduceMotion)}
              >
                <p className="text-sm text-muted-foreground">
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
                              reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }
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
                    <span> · Add combatants to track turns (use the Add creatures tab).</span>
                  )}
                  {loading ? <span className="ml-2 text-xs">(syncing…)</span> : null}
                </p>
              </motion.div>
            ) : null}
            {combatToolsTab === "add-creatures" ? (
              <motion.div
                key="add-creatures"
                id="combat-tabpanel-add-creatures"
                role="tabpanel"
                aria-labelledby="combat-tab-add-creatures"
                className="w-full"
                {...getTabPanelMotionProps(reduceMotion)}
              >
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
              </motion.div>
            ) : null}
            {combatToolsTab === "settings" ? (
              <motion.div
                key="settings"
                id="combat-tabpanel-settings"
                role="tabpanel"
                aria-labelledby="combat-tab-settings"
                className="w-full"
                {...getTabPanelMotionProps(reduceMotion)}
              >
                <motion.div
                  className="border-border/80 bg-muted/20 max-w-md rounded-lg border px-3 py-3"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: 0.04, duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
                    <input
                      type="checkbox"
                      checked={showTempHpControls}
                      onChange={(e) => persistShowTempHpControls(e.target.checked)}
                      className="border-input text-primary focus-visible:ring-ring mt-0.5 h-4 w-4 shrink-0 rounded border accent-primary focus-visible:outline-none focus-visible:ring-2"
                    />
                    <span>
                      <span className="text-foreground font-medium">Show Temp HP controls</span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        When off, the Temp HP field and Exact option are hidden on every combatant row. Pool values still
                        appear in the HP chip when present.
                      </span>
                    </span>
                  </label>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>

      <motion.div layout transition={{ layout: reduceMotion ? { duration: 0 } : TAB_SPRING }}>
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
                      : { opacity: 0, scale: 0.98, y: -8, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } }
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
                    showTempHpControls={showTempHpControls}
                    reduceMotion={reduceMotion}
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
      </motion.div>
    </motion.div>
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
  showTempHpControls,
  reduceMotion,
  supabase,
  reload,
  onRemoveFromCombat,
}: {
  combatant: Combatant;
  activeTurnCombatantId: string | null;
  isActiveTurn: boolean;
  rowClassName: string;
  showTempHpControls: boolean;
  reduceMotion: boolean | null;
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
  const [conditionInput, setConditionInput] = useState("");

  const conditions = useMemo(() => normalizeConditions(combatant.conditions), [combatant.conditions]);

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

  const persistConditions = useCallback(
    async (next: string[]) => {
      const normalized = normalizeConditions(next);
      const { data, error } = await supabase
        .from("combatants")
        .update({ conditions: normalized })
        .eq("id", combatant.id)
        .select("id");
      if (error) {
        console.error("Update combatant conditions:", error);
        return;
      }
      if (!data?.length) {
        console.error("Update combatant conditions: no row updated (check session access / RLS).");
        return;
      }
      void reload();
    },
    [combatant.id, reload, supabase]
  );

  const addConditionFromInput = useCallback(async () => {
    const t = conditionInput.trim();
    if (!t) return;
    const merged = normalizeConditions([...conditions, t]);
    setConditionInput("");
    if (merged.length === conditions.length) return;
    await persistConditions(merged);
  }, [conditionInput, conditions, persistConditions]);

  /** Slightly narrower than before — horizontal only; height matches default inputs. */
  const fieldClass = "w-[3.75rem] shrink-0 sm:w-[4.25rem]";
  const tempHpPool = combatant.temp_hp ?? 0;
  const initRead = combatant.initiative == null ? "—" : String(combatant.initiative);
  const chipStatInputClass =
    "ml-1 h-8 w-[4rem] shrink-0 border-0 bg-transparent px-1 py-0 text-sm font-semibold tabular-nums text-foreground shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-primary/35 sm:w-[4.25rem]";

  return (
    <motion.div
      layout
      transition={{ layout: reduceMotion ? { duration: 0 } : COMBAT_LIST_LAYOUT_SPRING }}
      className={cn(
        "motion-safe:transition-[box-shadow,background-color] motion-safe:duration-300 motion-safe:ease-out flex flex-row flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border p-3 sm:flex-nowrap sm:gap-x-4 sm:py-2.5",
        rowClassName,
        isActiveTurn && "ring-2 ring-primary ring-offset-2 ring-offset-background z-[1]"
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={editingBasics ? "basics-edit" : "basics-read"}
          className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 sm:gap-x-4"
          {...getBasicsStripMotionProps(reduceMotion, editingBasics ? "edit" : "read")}
        >
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
        </motion.div>
      </AnimatePresence>
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
          <AnimatePresence initial={false}>
            {showTempHpControls ? (
              <motion.div
                key="temp-hp-controls"
                layout
                className="w-[5.25rem] shrink-0 sm:w-[5.75rem]"
                {...getTempHpColumnMotionProps(reduceMotion)}
              >
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
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:bg-muted/50 h-8 gap-1 px-2 text-xs font-medium"
                disabled={editingBasics}
                aria-label={`Conditions and status for ${combatant.name}`}
              >
                <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Status</span>
                {conditions.length > 0 ? (
                  <span className="bg-primary/15 text-primary ml-0.5 min-w-[1.125rem] rounded-full px-1 py-px text-center text-[0.65rem] font-semibold tabular-nums leading-none">
                    {conditions.length}
                  </span>
                ) : null}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                asChild
                sideOffset={4}
                align="end"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <motion.div
                  className="border-border bg-background text-foreground z-50 max-h-[min(70vh,22rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-md border p-2 shadow-md"
                  {...getDropdownSurfaceMotionProps(reduceMotion)}
                >
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-xs font-medium">Active</p>
                    <div className="flex flex-wrap gap-1.5">
                      {conditions.length === 0 ? (
                        <p className="text-muted-foreground text-xs leading-snug">None — pick Quick toggles or add a custom label.</p>
                      ) : (
                        conditions.map((c) => (
                          <span
                            key={conditionKey(c)}
                            className="border-border bg-muted/50 text-foreground inline-flex max-w-full items-center gap-0.5 rounded-md border px-2 py-1 text-xs font-medium"
                          >
                            <span className="max-w-[10rem] truncate">{c}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0"
                              aria-label={`Remove ${c}`}
                              onClick={() =>
                                void persistConditions(conditions.filter((x) => conditionKey(x) !== conditionKey(c)))
                              }
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-xs font-medium">Custom</p>
                    <div className="flex flex-row items-center gap-1.5">
                      <Input
                        value={conditionInput}
                        onChange={(e) => setConditionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addConditionFromInput();
                          }
                        }}
                        placeholder="e.g. Hex, Slowed"
                        className="h-8 min-w-0 flex-1 text-xs"
                        aria-label="Custom condition name"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 shrink-0 px-2.5 text-xs"
                        disabled={!conditionInput.trim()}
                        onClick={() => void addConditionFromInput()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide">
                      Quick
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_COMBAT_CONDITIONS.map((label) => {
                        const on = conditions.some((x) => conditionKey(x) === conditionKey(label));
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => void persistConditions(toggleSuggestedCondition(conditions, label))}
                            className={cn(
                              "border-border bg-background text-foreground rounded-md border px-1.5 py-0.5 text-[0.7rem] transition-colors",
                              on && "border-primary/50 bg-primary/12 text-primary ring-1 ring-primary/20"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {conditions.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 w-full text-xs"
                      onClick={() => void persistConditions([])}
                    >
                      Clear all conditions
                    </Button>
                  ) : null}
                </div>
                </motion.div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <AnimatePresence mode="popLayout" initial={false}>
            {editingBasics ? (
              <motion.div
                key="basics-save-cancel"
                className="flex items-center gap-0.5"
                initial={reduceMotion ? false : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, x: 6, transition: { duration: 0.14 } }}
                transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 0.18 }, x: TAB_SPRING }}
              >
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
              </motion.div>
            ) : (
              <motion.div
                key="basics-pencil"
                className="flex items-center gap-0.5"
                initial={reduceMotion ? false : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, x: 6, transition: { duration: 0.14 } }}
                transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 0.18 }, x: TAB_SPRING }}
              >
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
              </motion.div>
            )}
          </AnimatePresence>
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
              <DropdownMenu.Content asChild sideOffset={4} align="end">
                <motion.div
                  className="border-border bg-background text-foreground z-50 min-w-[11rem] overflow-hidden rounded-md border p-1 shadow-md"
                  {...getDropdownSurfaceMotionProps(reduceMotion)}
                >
                  <DropdownMenu.Item
                    className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none"
                    onSelect={() => {
                      onRemoveFromCombat();
                    }}
                  >
                    Remove from combat
                  </DropdownMenu.Item>
                </motion.div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </motion.div>
  );
}
