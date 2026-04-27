export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { PageContainer } from "@/components/ui/PageGradientContainer";
import { PlayerSessionDashboard } from "@/components/combat/PlayerSessionDashboard";
import type { CombatSession } from "@/components/combat/types";

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function PlayerSessionPage(props: PageProps) {
  const { sessionId } = await props.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membershipRow } = await supabase
    .from("session_players")
    .select("id")
    .eq("player_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!membershipRow) notFound();

  const { data: sessionRowRaw } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
  const sessionRow = sessionRowRaw as CombatSession | null;
  if (!sessionRow) notFound();

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Link
            href="/player"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
          >
            Back to player lobby
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{sessionRow.name}</h1>
        </div>
        <PlayerSessionDashboard sessionId={sessionId} playerId={user.id} />
      </div>
    </PageContainer>
  );
}

