"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/card";
import { useCombatSession } from "@/components/combat/useCombatSession";
import { createSupabaseClient } from "@/utils/supabase/client";
import type { Tables } from "@/types/supabase";

type SessionRow = Tables<"sessions">;

type Props = {
  userId: string;
  memberships: { sessions: SessionRow | null }[];
  selectedSessionId: string | null;
};

export function PlayerCombatView({ userId, memberships, selectedSessionId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { session, combatants, loading } = useCombatSession(selectedSessionId);
  const [joinCode, setJoinCode] = useState("");

  async function joinSession(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    await supabase.from("session_players").upsert({ session_id: joinCode.trim(), player_id: userId });
    router.push(`/player?session=${joinCode.trim()}`);
    setJoinCode("");
  }

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Join Session</h2>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={joinSession}>
          <input
            className="rounded border px-3 py-2"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Paste session UUID"
          />
          <Button type="submit">Join</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Joined Sessions</h2>
        <div className="flex flex-wrap gap-2">
          {memberships.map((membership) => {
            const joinedSession = membership.sessions;
            if (!joinedSession) return null;
            return (
              <Button
                key={joinedSession.id}
                type="button"
                variant={joinedSession.id === selectedSessionId ? "default" : "outline"}
                onClick={() => router.push(`/player?session=${joinedSession.id}`)}
              >
                {joinedSession.name}
              </Button>
            );
          })}
        </div>
      </Card>

      {session && (
        <Card className="p-4">
          <h2 className="mb-1 text-lg font-semibold">Live Encounter: {session.name}</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Round {session.current_round} - Status {session.combat_status} {loading ? "(syncing...)" : ""}
          </p>
          <div className="grid gap-2">
            {combatants.map((combatant, index) => {
              const isCurrent = index === session.current_turn_index;
              return (
                <div
                  key={combatant.id}
                  className={`rounded border p-3 ${isCurrent ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <strong>{combatant.name}</strong>
                    <span>Init {combatant.initiative ?? 0}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    HP {combatant.hp_current}/{combatant.hp_max} | AC {combatant.armor_class}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Conditions: {Array.isArray(combatant.conditions) ? combatant.conditions.join(", ") || "None" : "None"}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
