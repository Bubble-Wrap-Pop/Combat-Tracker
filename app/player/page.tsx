export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { PageContainer } from "@/components/ui/PageGradientContainer";
import { PlayerCombatView } from "@/components/combat/PlayerCombatView";

type SearchParams = Promise<{ session?: string }>;

export default async function PlayerPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("session_players")
    .select("sessions(*)")
    .eq("player_id", user.id);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold text-zinc-900 dark:text-white">Player Live View</h1>
        <PlayerCombatView
          userId={user.id}
          memberships={memberships ?? []}
          selectedSessionId={searchParams.session ?? null}
        />
      </div>
    </PageContainer>
  );
}
