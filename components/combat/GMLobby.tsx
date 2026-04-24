"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CombatSession } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";

type Props = {
  userId: string;
  combats: CombatSession[];
};

export function GMLobby({ userId, combats }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [combatName, setCombatName] = useState("");

  async function createCombat(e: FormEvent) {
    e.preventDefault();
    if (!combatName.trim()) return;
    const { data } = await supabase
      .from("sessions")
      .insert({ name: combatName.trim(), game_master_id: userId })
      .select("id")
      .single();
    setCombatName("");
    if (data?.id) router.push(`/gm/sessions/${data.id}`);
  }

  async function deleteCombat(id: string, name: string) {
    const ok = window.confirm(`Delete “${name}”? This cannot be undone.`);
    if (!ok) return;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>New combat</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={createCombat}>
            <div className="flex-1">
              <label htmlFor="gm-new-combat-name" className="mb-1 block text-xs font-medium text-muted-foreground">
                Combat name
              </label>
              <Input
                id="gm-new-combat-name"
                value={combatName}
                onChange={(e) => setCombatName(e.target.value)}
                placeholder="Forest ambush"
              />
            </div>
            <Button type="submit">Create combat</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your combats</CardTitle>
        </CardHeader>
        <CardContent>
          {combats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No combats yet. Create one to open the encounter screen.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {combats.map((entry) => (
                <li key={entry.id} className="flex items-stretch gap-2">
                  <Link
                    href={`/gm/sessions/${entry.id}`}
                    className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {entry.name}
                  </Link>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="shrink-0 self-center"
                    onClick={() => void deleteCombat(entry.id, entry.name)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
