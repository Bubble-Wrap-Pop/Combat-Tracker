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
import type { Combatant } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getNextTurnState } from "@/lib/combat";
import {
  applyDamage,
  applyTempHpOverride,
  applyTempHpRule,
  isMinionName,
} from "@/lib/combatHealth";
import {
  applyDamageToCombatant,
  applyHealToCombatant,
  deleteCombatantById,
  persistCombatantResources,
} from "@/lib/combatSupabase";
import {
  conditionKey,
  normalizeConditions,
  SUGGESTED_COMBAT_CONDITIONS,
  toggleSuggestedCondition,
} from "@/lib/combatConditions";
import {
  applyLongRestRecharge,
  applyShortRestRecharge,
  normalizeResources,
  removeResource,
  upsertResource,
  type CombatResource,
  type ResourceRechargePolicy,
} from "@/lib/combatResources";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Props = {
  sessionId: string;
};

type CombatToolsTabId = "turn-order" | "add-creatures" | "settings";
type AutoDeleteMode = "multiples" | "all_non_players" | "none";

const COMBAT_TOOLS_TABS: { id: CombatToolsTabId; label: string }[] = [
  { id: "turn-order", label: "Turn order" },
  { id: "add-creatures", label: "Add creatures" },
  { id: "settings", label: "Settings" },
];

const RESOURCE_RECHARGE_OPTIONS: { value: ResourceRechargePolicy; label: string }[] = [
  { value: "short_rest", label: "Short Rest" },
  { value: "long_rest", label: "Long Rest" },
  { value: "manual", label: "Manual" },
];
const CONCENTRATION_LABEL = "Concentrating";

const SHOW_TEMP_HP_STORAGE_KEY = "combat-tracker-gm-show-temp-hp";
const AUTO_DELETE_MODE_STORAGE_KEY = "combat-tracker-gm-auto-delete-mode";

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

function shouldAutoDeleteAtZero(c: Combatant, mode: AutoDeleteMode): boolean {
  if (c.auto_delete_exempt) return false;
  if (mode === "none") return false;
  if (mode === "all_non_players") return !c.is_player;
  return isMinionName(c.name);
}

/** GM encounter tools. Live reads and HP sync use {@link useCombatSession} — Realtime on `sessions` and `combatants`. */
export function GMCombatDashboard({ sessionId }: Props) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { session, combatants, loading, realtimeStatus, reload } = useCombatSession(sessionId);
  const reduceMotion = useReducedMotion();

  const [creatureName, setCreatureName] = useState("");
  const [maxHp, setMaxHp] = useState(10);
  const [addCount, setAddCount] = useState(1);
  const [addInitiative, setAddInitiative] = useState(0);
  const [addAc, setAddAc] = useState(10);
  const [combatToolsTab, setCombatToolsTab] = useState<CombatToolsTabId>("turn-order");
  const [showTempHpControls, setShowTempHpControls] = useState(true);
  const [autoDeleteMode, setAutoDeleteMode] = useState<AutoDeleteMode>("multiples");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [generateMonsterLoading, setGenerateMonsterLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = globalThis.localStorage?.getItem(SHOW_TEMP_HP_STORAGE_KEY);
      queueMicrotask(() => {
        if (raw === "0" || raw === "false") setShowTempHpControls(false);
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const raw = globalThis.localStorage?.getItem(AUTO_DELETE_MODE_STORAGE_KEY);
      queueMicrotask(() => {
        if (raw === "multiples" || raw === "all_non_players" || raw === "none") {
          setAutoDeleteMode(raw);
        }
      });
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

  const persistAutoDeleteMode = useCallback((next: AutoDeleteMode) => {
    setAutoDeleteMode(next);
    try {
      globalThis.localStorage?.setItem(AUTO_DELETE_MODE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const activeRowIndex = session ? clampTurnIndex(session.current_turn_index, combatants.length) : -1;
  const activeCombatant = activeRowIndex >= 0 ? combatants[activeRowIndex] : null;
  const inviteLink =
    typeof globalThis.window === "undefined"
      ? `/player/sessions/${sessionId}`
      : `${globalThis.window.location.origin}/player/sessions/${sessionId}`;

  const copyInviteLink = useCallback(async () => {
    try {
      await globalThis.navigator?.clipboard?.writeText(inviteLink);
      setInviteCopied(true);
      globalThis.setTimeout(() => setInviteCopied(false), 1600);
    } catch {
      // ignore clipboard errors
    }
  }, [inviteLink]);

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
        ac_visible_to_players: false,
        is_player: false,
        owner_player_id: null,
        auto_delete_exempt: false,
        resources: [] as CombatResource[],
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
    [addAc, addCount, addInitiative, creatureName, maxHp, reload, session, supabase]
  );

  const generateRandomMonster = useCallback(async () => {
    if (!session?.id) return;
    setGenerateMonsterLoading(true);
    try {
      const res = await fetch("/api/generate-monster", { method: "POST" });
      if (!res.ok) {
        console.error("Generate monster API:", await res.text());
        return;
      }
      const data = (await res.json()) as { name: string; maxHp: number };
      const hp = Math.max(1, Math.floor(Number(data.maxHp)) || 1);
      const initRoll = Number.isFinite(Number(addInitiative)) ? Math.trunc(Number(addInitiative)) : 0;
      const acVal = Math.max(0, Math.floor(Number(addAc)) || 0);
      const trimmedName = typeof data.name === "string" ? data.name.trim() : "";
      if (!trimmedName) {
        console.error("Generate monster: empty name in response");
        return;
      }

      const row = {
        session_id: session.id,
        name: trimmedName,
        hp_max: hp,
        hp_current: hp,
        temp_hp: 0,
        initiative: initRoll,
        armor_class: acVal,
        ac_visible_to_players: false,
        is_player: false,
        owner_player_id: null,
        auto_delete_exempt: false,
        resources: [] as CombatResource[],
        conditions: [] as string[],
        revealed_traits: [] as string[],
      };

      const { error } = await supabase.from("combatants").insert(row);
      if (error) {
        console.error("Insert generated monster:", error);
        return;
      }
      setCombatToolsTab("turn-order");
      void reload();
    } catch (err) {
      console.error("Generate random monster:", err);
    } finally {
      setGenerateMonsterLoading(false);
    }
  }, [addAc, addInitiative, reload, session, supabase]);

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
                          <span className="text-muted-foreground">(init {activeCombatant.initiative ?? 0})</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span> · Add combatants to track turns (use the Add creatures tab).</span>
                  )}
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">Invite:</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void copyInviteLink()}>
                    {inviteCopied ? "Copied" : "Copy player link"}
                  </Button>
                  <span className="text-muted-foreground rounded-md border border-border/70 bg-muted/20 px-2 py-0.5 text-[0.7rem]">
                    Combat ID: {sessionId}
                  </span>
                </div>
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
                  <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
                    <Button type="submit">Add creatures</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={generateMonsterLoading}
                      onClick={() => void generateRandomMonster()}
                    >
                      {generateMonsterLoading ? "Generating…" : "Generate Random Monster"}
                    </Button>
                  </div>
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
                  className="space-y-3 max-w-md"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: 0.04, duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <div className="border-border/80 bg-muted/20 rounded-lg border px-3 py-3">
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
                  </div>
                  <div className="border-border/80 bg-muted/20 rounded-lg border px-3 py-3">
                    <label className="mb-1 block text-foreground text-sm font-medium">Auto-delete at 0 HP</label>
                    <p className="text-muted-foreground mb-2 text-xs">
                      Choose which combatants are removed automatically when they drop to 0 HP.
                    </p>
                    <select
                      value={autoDeleteMode}
                      onChange={(e) => persistAutoDeleteMode(e.target.value as AutoDeleteMode)}
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      aria-label="Auto-delete behavior"
                    >
                      <option value="multiples">Multiples only (e.g. Goblin (2))</option>
                      <option value="all_non_players">All non-players</option>
                      <option value="none">None</option>
                    </select>
                  </div>
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
                    autoDeleteMode={autoDeleteMode}
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
  autoDeleteMode,
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
  autoDeleteMode: AutoDeleteMode;
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
  const [showResourcesPanel, setShowResourcesPanel] = useState(false);
  const [resourcesEditMode, setResourcesEditMode] = useState(false);
  const [resourceNameInput, setResourceNameInput] = useState("");
  const [resourceMaxInput, setResourceMaxInput] = useState("");
  const [resourceRechargeInput, setResourceRechargeInput] = useState<ResourceRechargePolicy>("manual");

  const conditions = useMemo(() => normalizeConditions(combatant.conditions), [combatant.conditions]);
  const resources = useMemo(() => normalizeResources(combatant.resources), [combatant.resources]);
  const isConcentrating = useMemo(
    () => conditions.some((x) => conditionKey(x) === conditionKey(CONCENTRATION_LABEL)),
    [conditions]
  );
  const visibleConditions = useMemo(
    () => conditions.filter((x) => conditionKey(x) !== conditionKey(CONCENTRATION_LABEL)),
    [conditions]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setEditingBasics(false);
      setShowResourcesPanel(false);
      setResourcesEditMode(false);
    });
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
    const projected = applyDamage(combatant.hp_current, combatant.temp_hp ?? 0, amt);
    if (projected.hp_current === 0 && shouldAutoDeleteAtZero(combatant, autoDeleteMode)) {
      const del = await deleteCombatantById(supabase, combatant.id);
      if (!del.ok) return;
    } else {
      const res = await applyDamageToCombatant(supabase, combatant, amt);
      if (!res.ok) return;
    }
    setDamage("");
    if (isConcentrating && amt > 0 && projected.hp_current > 0) {
      const dc = Math.max(10, Math.floor(amt / 2));
      globalThis.alert(`Concentration check needed for ${combatant.name}: DC ${dc}`);
    }
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
    const res = await applyHealToCombatant(supabase, combatant, amt);
    if (!res.ok) return;
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

  const persistResources = useCallback(
    async (next: CombatResource[]) => {
      const normalized = normalizeResources(next);
      const res = await persistCombatantResources(supabase, combatant.id, normalized);
      if (!res.ok) {
        console.error("Update combatant resources:", res.error);
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

  const toggleConcentration = useCallback(async () => {
    const isOn = conditions.some((x) => conditionKey(x) === conditionKey(CONCENTRATION_LABEL));
    if (isOn) {
      await persistConditions(conditions.filter((x) => conditionKey(x) !== conditionKey(CONCENTRATION_LABEL)));
      return;
    }
    await persistConditions([...conditions, CONCENTRATION_LABEL]);
  }, [conditions, persistConditions]);

  const addResourceFromInput = useCallback(async () => {
    const name = resourceNameInput.trim();
    if (!name) return;
    const parsedMax = Math.max(0, Math.floor(Number(resourceMaxInput)) || 0);
    const resource: CombatResource = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      current: parsedMax,
      max: parsedMax,
      recharge: resourceRechargeInput,
    };
    const next = upsertResource(resources, resource);
    setResourceNameInput("");
    setResourceMaxInput("");
    setResourceRechargeInput("manual");
    await persistResources(next);
  }, [persistResources, resourceMaxInput, resourceNameInput, resourceRechargeInput, resources]);

  /** Slightly narrower than before — horizontal only; height matches default inputs. */
  const fieldClass = "w-[3.75rem] shrink-0 sm:w-[4.25rem]";
  const tempHpPool = combatant.temp_hp ?? 0;
  const initRead = combatant.initiative == null ? "—" : String(combatant.initiative);
  const statusCount = visibleConditions.length;
  const resourceCount = resources.length;
  const chipStatInputClass =
    "ml-1 h-8 w-[4rem] shrink-0 border-0 bg-transparent px-1 py-0 text-sm font-semibold tabular-nums text-foreground shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-primary/35 sm:w-[4.25rem]";

  return (
    <motion.div
      layout
      transition={{ layout: reduceMotion ? { duration: 0 } : COMBAT_LIST_LAYOUT_SPRING }}
      className={cn(
        "motion-safe:transition-[box-shadow,background-color] motion-safe:duration-300 motion-safe:ease-out flex flex-col gap-2 rounded-lg border border-border p-3 sm:py-2.5",
        rowClassName,
        isActiveTurn && "ring-2 ring-primary ring-offset-2 ring-offset-background z-[1]"
      )}
    >
      <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap lg:gap-x-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={editingBasics ? "basics-edit" : "basics-read"}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 md:flex-nowrap md:gap-x-4"
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
            <div className="min-w-0 flex-1 md:max-w-[13rem]">
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
            <div className="min-w-0 basis-full md:w-32 md:basis-auto md:flex-none md:shrink-0">
                <p className="text-sm font-semibold leading-tight tracking-tight text-foreground md:truncate sm:text-[0.95rem]">
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
      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 md:flex-nowrap md:gap-x-3">
        <div className="flex flex-wrap items-end justify-end gap-x-2 gap-y-1 md:flex-nowrap md:gap-x-3">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:bg-muted/50 h-8 gap-1 px-2 text-xs font-medium"
            disabled={editingBasics}
            aria-expanded={showResourcesPanel}
            aria-label={`Resources for ${combatant.name}`}
            onClick={() => {
              setShowResourcesPanel((prev) => {
                const next = !prev;
                if (!next) setResourcesEditMode(false);
                return next;
              });
            }}
          >
            <span className="hidden sm:inline">Resources</span>
            <span className="sm:hidden">Res</span>
            {resourceCount > 0 ? (
              <span className="bg-primary/15 text-primary ml-0.5 min-w-[1.125rem] rounded-full px-1 py-px text-center text-[0.65rem] font-semibold tabular-nums leading-none">
                {resourceCount}
              </span>
            ) : null}
          </Button>
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
                {statusCount > 0 ? (
                  <span className="bg-primary/15 text-primary ml-0.5 min-w-[1.125rem] rounded-full px-1 py-px text-center text-[0.65rem] font-semibold tabular-nums leading-none">
                    {statusCount}
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
                      {visibleConditions.length === 0 ? (
                        <p className="text-muted-foreground text-xs leading-snug">None — pick Quick toggles or add a custom label.</p>
                      ) : (
                        visibleConditions.map((c) => (
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
                  {visibleConditions.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 w-full text-xs"
                      onClick={() => void persistConditions(conditions.filter((x) => conditionKey(x) === conditionKey(CONCENTRATION_LABEL)))}
                    >
                      Clear all conditions
                    </Button>
                  ) : null}
                </div>
                </motion.div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "border-border text-muted-foreground hover:bg-muted/50 h-8 gap-1 px-2 text-xs font-medium",
              isConcentrating && "border-zinc-300 bg-white text-black hover:bg-zinc-100 dark:bg-zinc-100 dark:text-black"
            )}
            disabled={editingBasics}
            onClick={() => void toggleConcentration()}
            aria-label={`Toggle concentration for ${combatant.name}`}
            title="Toggle concentration"
          >
            ◈
          </Button>
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
                  {autoDeleteMode !== "none" &&
                  (shouldAutoDeleteAtZero(combatant, autoDeleteMode) || combatant.auto_delete_exempt) ? (
                    <DropdownMenu.Item
                      className="data-[highlighted]:bg-muted flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none"
                      onSelect={() => {
                        void supabase
                          .from("combatants")
                          .update({ auto_delete_exempt: !combatant.auto_delete_exempt })
                          .eq("id", combatant.id)
                          .then(({ error }) => {
                            if (error) {
                              console.error("Toggle auto-delete exclusion:", error);
                              return;
                            }
                            void reload();
                          });
                      }}
                    >
                      {combatant.auto_delete_exempt ? "Include in auto delete" : "Exclude from auto delete"}
                    </DropdownMenu.Item>
                  ) : null}
                  {combatant.is_player ? null : (
                    <DropdownMenu.Item
                      className="data-[highlighted]:bg-muted flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none"
                      onSelect={() => {
                        void supabase
                          .from("combatants")
                          .update({ ac_visible_to_players: !combatant.ac_visible_to_players })
                          .eq("id", combatant.id)
                          .then(({ error }) => {
                            if (error) {
                              console.error("Toggle AC visibility:", error);
                              return;
                            }
                            void reload();
                          });
                      }}
                    >
                      {combatant.ac_visible_to_players ? "Hide AC from players" : "Show AC to players"}
                    </DropdownMenu.Item>
                  )}
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
      </div>

      {visibleConditions.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wide">Active status:</span>
          {visibleConditions.map((c) => (
            <span
              key={conditionKey(c)}
              className="border-border bg-muted/55 text-foreground inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium"
            >
              <span className="max-w-[11rem] truncate">{c}</span>
            </span>
          ))}
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {showResourcesPanel ? (
          <motion.div
            key="resources-panel"
            layout
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, y: -6, transition: { duration: 0.16 } }}
            transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 0.18 }, y: TAB_SPRING, layout: TAB_SPRING }}
            className="border-border/70 bg-muted/20 min-w-0 rounded-md border p-2"
          >
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs font-medium">Resources</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.65rem]"
                  onClick={() => void persistResources(applyShortRestRecharge(resources))}
                  disabled={resources.length === 0}
                >
                  Short Rest
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.65rem]"
                  onClick={() => void persistResources(applyLongRestRecharge(resources))}
                  disabled={resources.length === 0}
                >
                  Long Rest
                </Button>
                <Button
                  type="button"
                  variant={resourcesEditMode ? "default" : "outline"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setResourcesEditMode((v) => !v)}
                  aria-label={resourcesEditMode ? "Finish editing resources" : "Edit resources"}
                  title={resourcesEditMode ? "Done editing resources" : "Edit resources"}
                >
                  {resourcesEditMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              {resources.length === 0 ? (
                <p className="text-muted-foreground text-xs leading-snug">No custom resources yet.</p>
              ) : (
                resources.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (resourcesEditMode) return;
                      if (r.current <= 0) return;
                      const next = upsertResource(resources, { ...r, current: Math.max(0, r.current - 1) });
                      void persistResources(next);
                    }}
                    className={cn(
                      "border-border/70 bg-background/60 flex items-center gap-1.5 rounded-md border p-1.5",
                      !resourcesEditMode && "cursor-pointer hover:bg-muted/35"
                    )}
                  >
                    {resourcesEditMode ? (
                      <Input
                        value={r.name}
                        onChange={(e) => {
                          const next = upsertResource(resources, { ...r, name: e.target.value });
                          void persistResources(next);
                        }}
                        className="h-7 min-w-0 flex-[1.2] text-xs"
                        aria-label={`Resource name ${r.name}`}
                      />
                    ) : (
                      <span className="min-w-0 flex-[1.2] truncate text-xs font-medium">{r.name}</span>
                    )}
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={String(r.current)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const nextCurrent = Math.max(0, Math.floor(Number(e.target.value)) || 0);
                        const next = upsertResource(resources, { ...r, current: Math.min(nextCurrent, r.max) });
                        void persistResources(next);
                      }}
                      className="h-7 w-14 px-1 text-center text-xs tabular-nums"
                      aria-label={`Current ${r.name}`}
                    />
                    <span className="text-muted-foreground text-xs">/</span>
                    {resourcesEditMode ? (
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={String(r.max)}
                        onChange={(e) => {
                          const nextMax = Math.max(0, Math.floor(Number(e.target.value)) || 0);
                          const next = upsertResource(resources, {
                            ...r,
                            max: nextMax,
                            current: Math.min(r.current, nextMax),
                          });
                          void persistResources(next);
                        }}
                        className="h-7 w-14 px-1 text-center text-xs tabular-nums"
                        aria-label={`Max ${r.name}`}
                      />
                    ) : (
                      <span className="text-muted-foreground w-14 text-center text-xs tabular-nums">{r.max}</span>
                    )}
                    {resourcesEditMode ? (
                      <select
                        value={r.recharge}
                        onChange={(e) => {
                          const next = upsertResource(resources, {
                            ...r,
                            recharge: e.target.value as ResourceRechargePolicy,
                          });
                          void persistResources(next);
                        }}
                        className="border-input bg-background h-7 min-w-0 rounded-md border px-1.5 text-[0.65rem]"
                        aria-label={`Recharge policy ${r.name}`}
                      >
                        {RESOURCE_RECHARGE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground min-w-[4.5rem] text-[0.65rem]">
                        {RESOURCE_RECHARGE_OPTIONS.find((x) => x.value === r.recharge)?.label ?? "Manual"}
                      </span>
                    )}
                    {resourcesEditMode ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0"
                        aria-label={`Remove resource ${r.name}`}
                        onClick={() => void persistResources(removeResource(resources, r.id))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            {resourcesEditMode ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Input
                  value={resourceNameInput}
                  onChange={(e) => setResourceNameInput(e.target.value)}
                  placeholder="Resource name"
                  className="h-8 min-w-0 flex-1 text-xs"
                  aria-label="New resource name"
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  value={resourceMaxInput}
                  onChange={(e) => setResourceMaxInput(e.target.value)}
                  placeholder="Max"
                  className="h-8 w-14 px-1 text-center text-xs tabular-nums"
                  aria-label="New resource max"
                />
                <select
                  value={resourceRechargeInput}
                  onChange={(e) => setResourceRechargeInput(e.target.value as ResourceRechargePolicy)}
                  className="border-input bg-background h-8 min-w-0 rounded-md border px-1.5 text-[0.7rem]"
                  aria-label="New resource recharge policy"
                >
                  {RESOURCE_RECHARGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 shrink-0 px-2.5 text-xs"
                  disabled={!resourceNameInput.trim()}
                  onClick={() => void addResourceFromInput()}
                >
                  Add
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1.5 text-[0.7rem]">Tip: click a resource row to spend 1 use.</p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
