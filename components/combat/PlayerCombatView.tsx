"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CombatSession } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";

type Props = {
  userId: string;
  memberships: { sessions: CombatSession[] | CombatSession | null }[];
};

export function PlayerCombatView({ userId, memberships }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

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
