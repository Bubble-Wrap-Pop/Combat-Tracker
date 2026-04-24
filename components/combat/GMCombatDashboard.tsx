"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCombatSession } from "@/components/combat/useCombatSession";
import type { CombatSession, Combatant } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getNextTurnState } from "@/lib/combat";

type Props = {
  userId: string;
  sessions: CombatSession[];
  selectedSessionId: string | null;
};

export function GMCombatDashboard({ userId, sessions, selectedSessionId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { session, combatants, loading } = useCombatSession(selectedSessionId);
  const [sessionName, setSessionName] = useState("");
  const [newCombatant, setNewCombatant] = useState({
    name: "",
    initiative: 0,
    hp_current: 10,
    hp_max: 10,
    armor_class: 10,
    is_player: false,
  });

  async function createSession(e: FormEvent) {
    e.preventDefault();
    if (!sessionName.trim()) return;
    const { data } = await supabase
      .from("sessions")
      .insert({ name: sessionName.trim(), game_master_id: userId })
      .select("id")
      .single();
    setSessionName("");
    if (data?.id) router.push(`/gm?session=${data.id}`);
  }

  async function addCombatant(e: FormEvent) {
    e.preventDefault();
    if (!session?.id || !newCombatant.name.trim()) return;
    await supabase.from("combatants").insert({
      ...newCombatant,
      name: newCombatant.name.trim(),
      session_id: session.id,
      conditions: [],
    });
    setNewCombatant((current) => ({ ...current, name: "" }));
  }

  async function updateCombatant(id: string, patch: Partial<Combatant>) {
    await supabase.from("combatants").update(patch).eq("id", id);
  }

  async function deleteCombatant(id: string) {
    await supabase.from("combatants").delete().eq("id", id);
  }

  async function advanceTurn() {
    if (!session) return;
    const { nextTurnIndex, nextRound } = getNextTurnState(
      session.current_turn_index,
      session.current_round,
      combatants.length
    );
    await supabase
      .from("sessions")
      .update({ current_turn_index: nextTurnIndex, current_round: nextRound, combat_status: "active" })
      .eq("id", session.id);
  }

  async function updateStatus(status: "setup" | "active" | "completed") {
    if (!session) return;
    await supabase.from("sessions").update({ combat_status: status }).eq("id", session.id);
  }

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Create Session</h2>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createSession}>
          <input
            className="rounded border px-3 py-2"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Encounter name"
          />
          <Button type="submit">Create</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Your Sessions</h2>
        <div className="flex flex-wrap gap-2">
          {sessions.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              variant={entry.id === selectedSessionId ? "default" : "outline"}
              onClick={() => router.push(`/gm?session=${entry.id}`)}
            >
              {entry.name}
            </Button>
          ))}
        </div>
      </Card>

      {session && (
        <>
          <Card className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Encounter Controls</h2>
            <p className="mb-3 text-sm text-zinc-600">
              Round {session.current_round}, Turn Index {session.current_turn_index}, Status: {session.combat_status}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void updateStatus("active")}>
                Start Encounter
              </Button>
              <Button type="button" variant="outline" onClick={() => void advanceTurn()}>
                Next Turn
              </Button>
              <Button type="button" variant="destructive" onClick={() => void updateStatus("completed")}>
                End Encounter
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Add Combatant</h2>
            <form className="grid gap-2 sm:grid-cols-3" onSubmit={addCombatant}>
              <input
                className="rounded border px-3 py-2"
                value={newCombatant.name}
                onChange={(e) => setNewCombatant((s) => ({ ...s, name: e.target.value }))}
                placeholder="Name"
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                value={newCombatant.initiative}
                onChange={(e) => setNewCombatant((s) => ({ ...s, initiative: Number(e.target.value) }))}
                placeholder="Initiative"
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                value={newCombatant.armor_class}
                onChange={(e) => setNewCombatant((s) => ({ ...s, armor_class: Number(e.target.value) }))}
                placeholder="AC"
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                value={newCombatant.hp_current}
                onChange={(e) => setNewCombatant((s) => ({ ...s, hp_current: Number(e.target.value) }))}
                placeholder="HP Current"
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                value={newCombatant.hp_max}
                onChange={(e) => setNewCombatant((s) => ({ ...s, hp_max: Number(e.target.value) }))}
                placeholder="HP Max"
              />
              <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={newCombatant.is_player}
                  onChange={(e) => setNewCombatant((s) => ({ ...s, is_player: e.target.checked }))}
                />
                Player Character
              </label>
              <Button className="sm:col-span-3" type="submit">
                Add Combatant
              </Button>
            </form>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Combatants {loading ? "(syncing...)" : ""}</h2>
            <div className="grid gap-3">
              {combatants.map((combatant, index) => (
                <div key={combatant.id} className="grid gap-2 rounded border p-3 sm:grid-cols-6">
                  <div className="font-medium">
                    #{index + 1} {combatant.name}
                  </div>
                  <input
                    className="rounded border px-2 py-1"
                    type="number"
                    value={combatant.initiative ?? 0}
                    onChange={(e) => void updateCombatant(combatant.id, { initiative: Number(e.target.value) })}
                  />
                  <input
                    className="rounded border px-2 py-1"
                    type="number"
                    value={combatant.hp_current}
                    onChange={(e) => void updateCombatant(combatant.id, { hp_current: Number(e.target.value) })}
                  />
                  <input
                    className="rounded border px-2 py-1"
                    type="number"
                    value={combatant.hp_max}
                    onChange={(e) => void updateCombatant(combatant.id, { hp_max: Number(e.target.value) })}
                  />
                  <input
                    className="rounded border px-2 py-1"
                    type="text"
                    defaultValue={Array.isArray(combatant.conditions) ? combatant.conditions.join(", ") : ""}
                    placeholder="conditions csv"
                    onBlur={(e) =>
                      void updateCombatant(combatant.id, {
                        conditions: e.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <Button type="button" variant="destructive" onClick={() => void deleteCombatant(combatant.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
