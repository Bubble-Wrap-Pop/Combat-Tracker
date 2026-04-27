"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CombatSession } from "@/components/combat/types";
import { cn } from "@/lib/utils";
import { createSupabaseClient } from "@/utils/supabase/client";

type MembershipRow = { sessions: CombatSession[] | CombatSession | null };

type Props = {
  userId: string;
  memberships: MembershipRow[];
};

/** Live lobby list synced via Realtime (`session_players` + `sessions`). */
export function PlayerCombatView({ userId, memberships: initialMemberships }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [memberships, setMemberships] = useState<MembershipRow[]>(initialMemberships);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live">("connecting");

  useEffect(() => {
    setMemberships(initialMemberships);
  }, [initialMemberships]);

  /** Stable key while only non-ID fields change on rows — avoids Realtime reconnect churn */
  const sessionIdsKey = useMemo(() => {
    return memberships
      .map((row) => {
        const joined = Array.isArray(row.sessions) ? row.sessions[0] ?? null : row.sessions;
        return joined?.id ?? "";
      })
      .filter(Boolean)
      .sort()
      .join(",");
  }, [memberships]);

  const refetchMemberships = useCallback(async () => {
    const { data, error } = await supabase
      .from("session_players")
      .select("sessions(*)")
      .eq("player_id", userId);
    if (error) {
      console.error("Refetch memberships:", error);
      return;
    }
    setMemberships((data as MembershipRow[]) ?? []);
  }, [supabase, userId]);

  useEffect(() => {
    let playersDone = false;

    const watchedIds = sessionIdsKey ? sessionIdsKey.split(",").filter(Boolean) : [];
    let sessionsDone = watchedIds.length === 0;

    const tryLive = () => {
      if (playersDone && sessionsDone) setRealtimeStatus("live");
    };

    const playersChannel = supabase
      .channel(`player-lobby-players-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_players", filter: `player_id=eq.${userId}` },
        () => void refetchMemberships()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          playersDone = true;
          tryLive();
          void refetchMemberships();
        }
      });

    let sessionsChannel: ReturnType<typeof supabase.channel> | null = null;
    const channelSuffix = sessionIdsKey || "none";

    if (watchedIds.length > 0) {
      sessionsChannel = supabase.channel(`player-lobby-sessions-${userId}-${channelSuffix}`);
      for (const sid of watchedIds) {
        sessionsChannel.on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sid}` },
          () => void refetchMemberships()
        );
      }
      sessionsChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          sessionsDone = true;
          tryLive();
        }
      });
    }

    return () => {
      void supabase.removeChannel(playersChannel);
      if (sessionsChannel) void supabase.removeChannel(sessionsChannel);
    };
  }, [sessionIdsKey, refetchMemberships, supabase, userId]);

  const normalizedInput = joinCode.trim();
  const extractedSessionId = useMemo(() => {
    if (!normalizedInput) return "";
    if (/^[0-9a-fA-F-]{36}$/.test(normalizedInput)) return normalizedInput;
    const directMatch = normalizedInput.match(/\/player\/sessions\/([0-9a-fA-F-]{36})/i);
    if (directMatch) return directMatch[1];
    const gmMatch = normalizedInput.match(/\/gm\/sessions\/([0-9a-fA-F-]{36})/i);
    if (gmMatch) return gmMatch[1];
    return "";
  }, [normalizedInput]);

  async function joinSession(e: FormEvent) {
    e.preventDefault();
    setJoinError(null);
    if (!extractedSessionId) {
      setJoinError("Paste a valid session ID or invite link.");
      return;
    }
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id,is_active")
      .eq("id", extractedSessionId)
      .maybeSingle();
    if (sessionErr || !session) {
      setJoinError("Combat not found.");
      return;
    }
    if (!session.is_active) {
      setJoinError("That combat is no longer active.");
      return;
    }
    const { error } = await supabase.from("session_players").upsert({ session_id: extractedSessionId, player_id: userId });
    if (error) {
      setJoinError(error.message);
      return;
    }
    router.push(`/player/sessions/${extractedSessionId}`);
    setJoinCode("");
  }

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Join a combat</h2>
        <form className="space-y-2" onSubmit={joinSession}>
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Paste invite link or combat ID"
          />
          {joinError ? <p className="text-xs text-destructive">{joinError}</p> : null}
          <div className="flex items-center gap-2">
            <Button type="submit">Join</Button>
            <span className="text-xs text-muted-foreground">GM can share a direct invite link now.</span>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Your combats</h2>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
              realtimeStatus === "live"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/80 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-300"
            )}
          >
            {realtimeStatus === "live" ? "Live" : "Syncing"}
          </span>
        </div>
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
                variant="outline"
                onClick={() => router.push(`/player/sessions/${joinedSession.id}`)}
              >
                {joinedSession.name}
              </Button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
