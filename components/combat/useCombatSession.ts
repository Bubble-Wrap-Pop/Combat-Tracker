"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/utils/supabase/client";
import type { CombatSession, Combatant } from "@/components/combat/types";

export function useCombatSession(sessionId: string | null) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [session, setSession] = useState<CombatSession | null>(null);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setCombatants([]);
      return;
    }

    setLoading(true);
    const [{ data: sessionData }, { data: combatantData }] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase
        .from("combatants")
        .select("*")
        .eq("session_id", sessionId)
        .order("initiative", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);

    setSession(sessionData ?? null);
    setCombatants(combatantData ?? []);
    setLoading(false);
  }, [sessionId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;

    const sessionChannel = supabase
      .channel(`sessions-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        () => void load()
      )
      .subscribe();

    const combatantsChannel = supabase
      .channel(`combatants-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "combatants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(sessionChannel);
      void supabase.removeChannel(combatantsChannel);
    };
  }, [load, sessionId, supabase]);

  return {
    session,
    combatants,
    loading,
    reload: load,
  };
}
