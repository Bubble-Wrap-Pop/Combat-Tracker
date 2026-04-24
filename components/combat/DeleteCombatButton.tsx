"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseClient } from "@/utils/supabase/client";

type Props = {
  combatId: string;
  combatName: string;
};

export function DeleteCombatButton({ combatId, combatName }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);

  async function onDelete() {
    const ok = window.confirm(
      `Delete “${combatName}”? All creatures and player links for this combat will be removed.`
    );
    if (!ok) return;
    const { error } = await supabase.from("sessions").delete().eq("id", combatId);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.push("/gm");
    router.refresh();
  }

  return (
    <Button type="button" variant="destructive" size="sm" className="shrink-0" onClick={() => void onDelete()}>
      Delete combat
    </Button>
  );
}
