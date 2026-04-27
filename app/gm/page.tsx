export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { PageContainer } from "@/components/ui/PageGradientContainer";
import { GMLobby } from "@/components/combat/GMLobby";
import type { Campaign, CombatSession } from "@/components/combat/types";

export default async function GMPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sessionsData } = await supabase
    .from("sessions")
    .select("*")
    .eq("game_master_id", user.id)
    .order("created_at", { ascending: false });

  const { data: campaignsData } = await supabase
    .from("campaigns")
    .select("*")
    .eq("game_master_id", user.id)
    .order("created_at", { ascending: false });

  const combats = (sessionsData ?? []) as CombatSession[];
  const campaigns = (campaignsData ?? []) as Campaign[];

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold text-zinc-900 dark:text-white">GM combat lobby</h1>
        <GMLobby userId={user.id} combats={combats} campaigns={campaigns} />
      </div>
    </PageContainer>
  );
}
