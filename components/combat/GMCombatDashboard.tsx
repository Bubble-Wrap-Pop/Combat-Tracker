"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCombatSession } from "@/components/combat/useCombatSession";
import type { Combatant } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getNextTurnState } from "@/lib/combat";
import {
  applyDamage,
  applyHeal,
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
  const { session, combatants, loading } = useCombatSession(sessionId);

  const [creatureName, setCreatureName] = useState("");
  const [maxHp, setMaxHp] = useState(10);
  const [addCount, setAddCount] = useState(1);

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
      if (hp <= 0) return;

      const rows = Array.from({ length: count }, (_, i) => ({
        session_id: session.id,
        name: count > 1 ? `${base} (${i + 1})` : base,
        hp_max: hp,
        hp_current: hp,
        temp_hp: 0,
        initiative: 0,
        armor_class: 10,
        is_player: false,
        conditions: [] as string[],
        revealed_traits: [] as string[],
      }));

      await supabase.from("combatants").insert(rows);
      setCreatureName("");
      setMaxHp(10);
      setAddCount(1);
    },
    [addCount, creatureName, maxHp, session?.id, supabase]
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
  }

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
                      </>
                    ) : null}
                  </>
                ) : (
                  <span> · Add combatants to track turns.</span>
                )}
                {loading ? <span className="ml-2 text-xs">(syncing…)</span> : null}
              </p>
            </div>
            <Button type="button" variant="default" disabled={combatants.length === 0} onClick={() => void advanceTurn()}>
              Next turn
            </Button>
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
                displayIndex={index + 1}
                isActiveTurn={index === activeRowIndex}
                rowClassName={rowBackgroundClass(combatant)}
                supabase={supabase}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CombatantRow({
  combatant,
  displayIndex,
  isActiveTurn,
  rowClassName,
  supabase,
}: {
  combatant: Combatant;
  displayIndex: number;
  isActiveTurn: boolean;
  rowClassName: string;
  supabase: ReturnType<typeof createSupabaseClient>;
}) {
  const [damage, setDamage] = useState("");
  const [heal, setHeal] = useState("");
  const [temp, setTemp] = useState("");

  const applyDamageAction = async () => {
    const amt = Math.max(0, Math.floor(Number(damage)) || 0);
    if (amt <= 0) return;
    const { hp_current, temp_hp } = applyDamage(combatant.hp_current, combatant.temp_hp ?? 0, amt);
    if (shouldDeleteMinionAtZero(hp_current, combatant.name)) {
      await supabase.from("combatants").delete().eq("id", combatant.id);
    } else {
      await supabase.from("combatants").update({ hp_current, temp_hp }).eq("id", combatant.id);
    }
    setDamage("");
  };

  const applyHealAction = async () => {
    const amt = Math.max(0, Math.floor(Number(heal)) || 0);
    if (amt <= 0) return;
    const hp_current = applyHeal(combatant.hp_current, combatant.hp_max, amt);
    await supabase.from("combatants").update({ hp_current }).eq("id", combatant.id);
    setHeal("");
  };

  const applyTempAction = async () => {
    const amt = Math.max(0, Math.floor(Number(temp)) || 0);
    const temp_hp = applyTempHpRule(combatant.temp_hp ?? 0, amt);
    await supabase.from("combatants").update({ temp_hp }).eq("id", combatant.id);
    setTemp("");
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:gap-4",
        rowClassName,
        isActiveTurn && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div className="min-w-0 shrink-0 sm:w-40">
        <div className="font-medium text-foreground">
          #{displayIndex} {combatant.name}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 text-sm sm:flex-1">
        <div>
          HP{" "}
          <span className="font-medium">
            {combatant.hp_current} / {combatant.hp_max}
          </span>
        </div>
        <div className="text-muted-foreground">
          Temp HP: <span className="font-medium text-foreground">{combatant.temp_hp}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void applyDamageAction();
          }}
        >
          <div className="w-24">
            <label className="mb-1 block text-xs text-muted-foreground">Damage</label>
            <Input type="number" min={0} value={damage} onChange={(e) => setDamage(e.target.value)} placeholder="0" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
        </form>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void applyHealAction();
          }}
        >
          <div className="w-24">
            <label className="mb-1 block text-xs text-muted-foreground">Heal</label>
            <Input type="number" min={0} value={heal} onChange={(e) => setHeal(e.target.value)} placeholder="0" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
        </form>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void applyTempAction();
          }}
        >
          <div className="w-24">
            <label className="mb-1 block text-xs text-muted-foreground">Temp HP</label>
            <Input type="number" min={0} value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="0" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Set
          </Button>
        </form>
      </div>
    </div>
  );
}
