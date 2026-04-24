"use client";

import { FormEvent, useCallback, useMemo, useState, type KeyboardEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";
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

type Props = {
  sessionId: string;
};

function clampTurnIndex(turnIndex: number, len: number): number {
  if (len <= 0) return -1;
  return Math.min(Math.max(0, turnIndex), len - 1);
}

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

  const [creatureName, setCreatureName] = useState("");
  const [maxHp, setMaxHp] = useState(10);
  const [addCount, setAddCount] = useState(1);
  const [addInitiative, setAddInitiative] = useState(0);

  const activeRowIndex = session ? clampTurnIndex(session.current_turn_index, combatants.length) : -1;
  const activeCombatant = activeRowIndex >= 0 ? combatants[activeRowIndex] : null;

  const addCreatures = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!session?.id) return;
      const base = creatureName.trim();
      if (!base) return;
      const hp = Math.max(0, Math.floor(Number(maxHp)) || 0);
      const count = Math.max(1, Math.floor(Number(addCount)) || 1);
      const initRoll = Number.isFinite(Number(addInitiative)) ? Math.trunc(Number(addInitiative)) : 0;
      if (hp <= 0) return;

      const rows = Array.from({ length: count }, (_, i) => ({
        session_id: session.id,
        name: count > 1 ? `${base} (${i + 1})` : base,
        hp_max: hp,
        hp_current: hp,
        temp_hp: 0,
        initiative: initRoll,
        armor_class: 10,
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
    },
    [addCount, addInitiative, creatureName, maxHp, session?.id, supabase]
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

  const removeCombatantAt = useCallback(
    async (removedIndex: number) => {
      if (!session) return;
      if (removedIndex < 0 || removedIndex >= combatants.length) return;
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
                Round <span className="font-medium text-foreground">{session.current_round}</span>
                {combatants.length > 0 ? (
                  <>
                    {" "}
                    · Turn{" "}
                    <span className="font-medium text-foreground">
                      {activeRowIndex + 1} of {combatants.length}
                    </span>
                    {activeCombatant ? (
                      <>
                        {" "}
                        · <span className="font-medium text-foreground">{activeCombatant.name}</span>
                        {" "}
                        <span className="text-muted-foreground">
                          (init {activeCombatant.initiative ?? 0})
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
            combatants.map((combatant, index) => (
              <CombatantRow
                key={combatant.id}
                combatant={combatant}
                session={session}
                activeTurnCombatantId={activeCombatant?.id ?? null}
                isActiveTurn={index === activeRowIndex}
                rowClassName={rowBackgroundClass(combatant)}
                supabase={supabase}
                reload={reload}
                onRemoveFromCombat={() => void removeCombatantAt(index)}
              />
            ))
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
  session,
  activeTurnCombatantId,
  isActiveTurn,
  rowClassName,
  supabase,
  reload,
  onRemoveFromCombat,
}: {
  combatant: Combatant;
  session: CombatSession;
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
  const [initiative, setInitiative] = useState("");
  const [tempHpExact, setTempHpExact] = useState(false);

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

  const applyInitiativeAction = async (raw: string) => {
    const t = raw.trim();
    if (t === "") return;
    const initiativeVal = Math.trunc(Number(t));
    if (!Number.isFinite(initiativeVal)) {
      setInitiative("");
      return;
    }
    if (combatant.initiative === initiativeVal) {
      setInitiative("");
      return;
    }
    const { data, error } = await supabase
      .from("combatants")
      .update({ initiative: initiativeVal })
      .eq("id", combatant.id)
      .select("id");
    if (error) {
      console.error("Update combatant initiative:", error);
      return;
    }
    if (!data?.length) {
      console.error("Update combatant initiative: no row updated (check session access / RLS).");
      return;
    }
    setInitiative("");
    const snap = await reload();
    if (!snap?.session || !activeTurnCombatantId) return;
    const idx = snap.combatants.findIndex((c) => c.id === activeTurnCombatantId);
    if (idx < 0) return;
    if (idx === snap.session.current_turn_index) return;
    await supabase.from("sessions").update({ current_turn_index: idx }).eq("id", snap.session.id);
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

  const fieldClass = "w-[4.5rem] shrink-0 sm:w-20";
  const tempHpPool = combatant.temp_hp ?? 0;

  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border p-3 sm:flex-nowrap sm:gap-x-4 sm:py-2.5",
        rowClassName,
        isActiveTurn && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 sm:gap-x-4">
        <div className="w-[3.25rem] shrink-0 sm:w-14">
          <label className="mb-1 block text-xs text-muted-foreground">Init</label>
          <Input
            type="number"
            value={initiative}
            onChange={(e) => setInitiative(e.target.value)}
            onBlur={(e) => void applyInitiativeAction(e.target.value)}
            onKeyDown={enterToCommit}
            placeholder={combatant.initiative == null ? "—" : String(combatant.initiative)}
            className="h-9 tabular-nums"
          />
        </div>
        <div className="w-36 shrink-0 sm:w-48">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-[0.95rem]">
            {combatant.name}
          </p>
        </div>
        <div
          className="flex shrink-0 items-baseline gap-x-0.5 rounded-md border border-border/80 bg-background/50 px-2.5 py-1.5 text-sm tabular-nums shadow-sm ring-1 ring-black/5 dark:bg-background/30 dark:ring-white/10 sm:px-3 sm:text-[0.9375rem]"
          aria-label={`Hit points ${combatant.hp_current} of ${combatant.hp_max}${tempHpPool > 0 ? `, ${tempHpPool} temporary` : ""}`}
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">HP</span>
          <span className="ml-2 font-semibold text-foreground">{combatant.hp_current}</span>
          {tempHpPool > 0 ? (
            <span className="font-semibold text-sky-600 dark:text-sky-400">+{tempHpPool}</span>
          ) : null}
          <span className="text-muted-foreground">
            {" "}
            / {combatant.hp_max}
          </span>
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:flex-nowrap sm:gap-x-3">
        <div className="flex flex-wrap items-end justify-end gap-x-3 gap-y-1 sm:flex-nowrap sm:gap-x-4">
          <div className={fieldClass}>
          <label className="mb-1 block text-xs text-muted-foreground">Damage</label>
          <Input
            type="number"
            min={0}
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
            onBlur={(e) => void applyDamageAction(e.target.value)}
            onKeyDown={enterToCommit}
            placeholder="—"
            className="h-9"
          />
          </div>
          <div className={fieldClass}>
          <label className="mb-1 block text-xs text-muted-foreground">Heal</label>
          <Input
            type="number"
            min={0}
            value={heal}
            onChange={(e) => setHeal(e.target.value)}
            onBlur={(e) => void applyHealAction(e.target.value)}
            onKeyDown={enterToCommit}
            placeholder="—"
            className="h-9"
          />
          </div>
          <div className="w-[5.75rem] shrink-0 sm:w-[6.25rem]">
          <div className="mb-1 flex items-center justify-between gap-1">
            <span className="text-xs text-muted-foreground">Temp HP</span>
            <label
              className="flex cursor-pointer items-center gap-1 text-[0.65rem] leading-none text-muted-foreground"
              title="Set temp HP to this number even if lower than the current pool"
            >
              <input
                type="checkbox"
                checked={tempHpExact}
                onChange={(e) => setTempHpExact(e.target.checked)}
                className="border-input text-primary focus-visible:ring-ring h-3 w-3 shrink-0 rounded border accent-primary focus-visible:outline-none focus-visible:ring-1"
              />
              <span className="select-none">Exact</span>
            </label>
          </div>
          <Input
            type="number"
            min={0}
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            onBlur={(e) => void applyTempAction(e.target.value)}
            onKeyDown={enterToCommit}
            placeholder="—"
            className="h-9"
          />
          </div>
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
