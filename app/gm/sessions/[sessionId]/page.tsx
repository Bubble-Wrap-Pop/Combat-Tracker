export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { PageContainer } from "@/components/ui/PageGradientContainer";
import { GMCombatDashboard } from "@/components/combat/GMCombatDashboard";
import { DeleteCombatButton } from "@/components/combat/DeleteCombatButton";
import type { CombatSession } from "@/components/combat/types";

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function GMSessionPage(props: PageProps) {
  const { sessionId } = await props.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sessionRowRaw } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
  const sessionRow = sessionRowRaw as CombatSession | null;

  if (!sessionRow || sessionRow.game_master_id !== user.id) {
    notFound();
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
          <Link
            href="/gm"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
          >
            Back to combat lobby
          </Link>
        </div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{sessionRow.name}</h1>
          <DeleteCombatButton combatId={sessionId} combatName={sessionRow.name} />
        </div>
        <GMCombatDashboard sessionId={sessionId} />
      </div>
    </PageContainer>
  );
}
