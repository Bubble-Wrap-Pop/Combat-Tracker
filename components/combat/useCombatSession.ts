"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "@/utils/supabase/client";
import type { CombatSession, Combatant } from "@/components/combat/types";

export type CombatSessionSnapshot = {
  session: CombatSession | null;
  combatants: Combatant[];
};

export type RealtimeStatus = "connecting" | "live" | "reconnecting";

/** Loads `sessions` + `combatants` rows and listens to `postgres_changes` for that session (GM + joined players). */
export function useCombatSession(sessionId: string | null) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [session, setSession] = useState<CombatSession | null>(null);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [loading, setLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");

  const load = useCallback(async (): Promise<CombatSessionSnapshot | undefined> => {
    if (!sessionId) {
      setSession(null);
      setCombatants([]);
      return undefined;
    }

    setLoading(true);
    try {
      const [{ data: sessionData, error: sessionErr }, { data: combatantData, error: combatantErr }] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", sessionId).single(),
        supabase
          .from("combatants")
          .select("*")
          .eq("session_id", sessionId)
          .order("initiative", { ascending: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ]);

      if (sessionErr) {
        console.error("Load session:", sessionErr);
      }
      if (combatantErr) {
        console.error("Load combatants:", combatantErr);
      }

      const session = (sessionData ?? null) as CombatSession | null;
      const combatants = (combatantData ?? []) as Combatant[];
      setSession(session);
      setCombatants(combatants);
      return { session, combatants };
    } finally {
      setLoading(false);
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sessionId) return;
    setRealtimeStatus("connecting");
    let sessionSubscribed = false;
    let combatantsSubscribed = false;
    const markLiveIfReady = () => {
      if (sessionSubscribed && combatantsSubscribed) setRealtimeStatus("live");
    };

    const sessionChannel = supabase
      .channel(`sessions-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        () => void load()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          sessionSubscribed = true;
          markLiveIfReady();
          void load();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("reconnecting");
          console.warn("sessions realtime status:", status);
          void load();
        }
      });

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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          combatantsSubscribed = true;
          markLiveIfReady();
          void load();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("reconnecting");
          console.warn("combatants realtime status:", status);
          void load();
        }
      });

    return () => {
      void supabase.removeChannel(sessionChannel);
      void supabase.removeChannel(combatantsChannel);
    };
  }, [load, sessionId, supabase]);

  useEffect(() => {
    if (!sessionId) return;
    const refreshOnFocus = () => void load();
    const refreshOnVisible = () => {
      if (globalThis.document.visibilityState === "visible") void load();
    };
    globalThis.window.addEventListener("focus", refreshOnFocus);
    globalThis.window.addEventListener("online", refreshOnFocus);
    globalThis.document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      globalThis.window.removeEventListener("focus", refreshOnFocus);
      globalThis.window.removeEventListener("online", refreshOnFocus);
      globalThis.document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load, sessionId]);

  return {
    session,
    combatants,
    loading,
    realtimeStatus,
    reload: load,
  };
}
