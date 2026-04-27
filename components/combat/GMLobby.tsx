"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Campaign, CombatSession } from "@/components/combat/types";
import { createSupabaseClient } from "@/utils/supabase/client";

type Props = {
  userId: string;
  combats: CombatSession[];
  campaigns: Campaign[];
};

export function GMLobby({ userId, combats, campaigns }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [combatName, setCombatName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const [campaignFilterId, setCampaignFilterId] = useState<string>("all");
  const [copiedCombatId, setCopiedCombatId] = useState<string | null>(null);

  async function createCombat(e: FormEvent) {
    e.preventDefault();
    if (!combatName.trim()) return;
    const { data } = await supabase
      .from("sessions")
      .insert({
        name: combatName.trim(),
        game_master_id: userId,
        campaign_id: selectedCampaignId === "none" ? null : selectedCampaignId,
      })
      .select("id")
      .single();
    setCombatName("");
    if (data?.id) router.push(`/gm/sessions/${data.id}`);
  }

  async function createCampaign(e: FormEvent) {
    e.preventDefault();
    const trimmed = campaignName.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("campaigns").insert({ game_master_id: userId, name: trimmed });
    if (error) {
      window.alert(error.message);
      return;
    }
    setCampaignName("");
    router.refresh();
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

  async function copyInviteLink(id: string) {
    const origin = typeof globalThis.window === "undefined" ? "" : globalThis.window.location.origin;
    const link = `${origin}/player/sessions/${id}`;
    try {
      await globalThis.navigator?.clipboard?.writeText(link);
      setCopiedCombatId(id);
      globalThis.setTimeout(() => setCopiedCombatId((prev) => (prev === id ? null : prev)), 1400);
    } catch {
      // ignore clipboard failures
    }
  }

  const campaignNameById = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [campaigns]);
  const visibleCombats =
    campaignFilterId === "all"
      ? combats
      : campaignFilterId === "none"
        ? combats.filter((c) => !c.campaign_id)
        : combats.filter((c) => c.campaign_id === campaignFilterId);

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
            <div className="w-full sm:w-56">
              <label htmlFor="gm-new-combat-campaign" className="mb-1 block text-xs font-medium text-muted-foreground">
                Campaign (optional)
              </label>
              <select
                id="gm-new-combat-campaign"
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
              >
                <option value="none">None</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Create combat</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createCampaign}>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Iron Coast Campaign"
              className="sm:max-w-sm"
            />
            <Button type="submit" variant="outline">
              Add campaign
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filter:</span>
            <Button
              type="button"
              size="sm"
              variant={campaignFilterId === "all" ? "default" : "outline"}
              onClick={() => setCampaignFilterId("all")}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={campaignFilterId === "none" ? "default" : "outline"}
              onClick={() => setCampaignFilterId("none")}
            >
              Unassigned
            </Button>
            {campaigns.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={campaignFilterId === c.id ? "default" : "outline"}
                onClick={() => setCampaignFilterId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your combats</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleCombats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No combats yet. Create one to open the encounter screen.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleCombats.map((entry) => (
                <li key={entry.id} className="flex items-stretch gap-2">
                  <Link
                    href={`/gm/sessions/${entry.id}`}
                    className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <span className="truncate">{entry.name}</span>
                    <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                      {entry.campaign_id ? `· ${campaignNameById.get(entry.campaign_id) ?? "Campaign"}` : "· Unassigned"}
                    </span>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-center"
                    onClick={() => void copyInviteLink(entry.id)}
                  >
                    {copiedCombatId === entry.id ? "Copied" : "Copy invite"}
                  </Button>
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
