"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCombatSession } from "@/components/combat/useCombatSession";
import type { CombatSession } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";
import { conditionKey, normalizeConditions } from "@/lib/combatConditions";

type Props = {
  userId: string;
  memberships: { sessions: CombatSession[] | CombatSession | null }[];
  selectedSessionId: string | null;
};

const PLAYER_ROW_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

export function PlayerCombatView({ userId, memberships, selectedSessionId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const { session, combatants, loading } = useCombatSession(selectedSessionId);
  const [joinCode, setJoinCode] = useState("");
  const reduceMotion = useReducedMotion();

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
        <h2 className="mb-3 text-lg font-semibold">Join a combat</h2>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={joinSession}>
          <input
            className="rounded border px-3 py-2"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Paste combat ID (UUID)"
          />
          <Button type="submit">Join</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Your combats</h2>
        <div className="flex flex-wrap gap-2">
          {memberships.map((membership) => {
            const joinedSession = Array.isArray(membership.sessions)
              ? membership.sessions[0] ?? null
              : membership.sessions;
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
            Round{" "}
            <motion.span
              key={session.current_round}
              className="font-medium text-zinc-800 dark:text-zinc-200"
              initial={reduceMotion ? undefined : { opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              {session.current_round}
            </motion.span>{" "}
            - Status {session.combat_status} {loading ? "(syncing...)" : ""}
          </p>
          <div className="grid gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {combatants.map((combatant, index) => {
                const isCurrent = index === session.current_turn_index;
                const conditions = normalizeConditions(combatant.conditions);
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
                    className={`rounded border p-3 ${isCurrent ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <strong>{combatant.name}</strong>
                      <span>Init {combatant.initiative ?? 0}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      HP {combatant.hp_current}/{combatant.hp_max}
                      {(combatant.temp_hp ?? 0) > 0 ? ` · Temp ${combatant.temp_hp}` : ""} | AC {combatant.armor_class}
                    </div>
                    <div className="mt-2">
                      <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Conditions
                      </p>
                      {conditions.length === 0 ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">None</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {conditions.map((c) => (
                            <span
                              key={conditionKey(c)}
                              className="rounded-md border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>
      )}
    </div>
  );
}
