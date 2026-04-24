export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { PageContainer } from "@/components/ui/PageGradientContainer";
import { GMCombatDashboard } from "@/components/combat/GMCombatDashboard";

type SearchParams = Promise<{ session?: string }>;

export default async function GMPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("game_master_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold text-zinc-900 dark:text-white">GM Combat Dashboard</h1>
        <GMCombatDashboard userId={user.id} sessions={sessions ?? []} selectedSessionId={searchParams.session ?? null} />
      </div>
    </PageContainer>
  );
}
