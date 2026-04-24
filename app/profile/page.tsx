export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/PageGradientContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/layout/SignOutButton";
import type { Tables } from "@/lib/supabase-database";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Tables<"profiles"> | null;

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-zinc-200/70 pb-4 dark:border-zinc-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="truncate text-3xl font-bold text-zinc-900 dark:text-white">
                Profile
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Your account details and public display information.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <SignOutButton
                variant="outline"
                size="default"
                className="w-full sm:w-auto"
              />
              <Button href="/profile/edit" className="w-full sm:w-auto">
                Edit profile
              </Button>
            </div>
          </div>
        </header>

        <main>
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-28 w-28 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700 sm:h-32 sm:w-32"
                />
              ) : (
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-100 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 sm:h-32 sm:w-32">
                  No photo
                </div>
              )}
              <dl className="min-w-0 flex-1 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-200">Full name</dt>
                  <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {profile?.full_name?.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-200">Email</dt>
                  <dd className="mt-1 break-all text-zinc-600 dark:text-zinc-400">{user.email}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-200">User ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {user.id}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </main>
      </div>
    </PageContainer>
  );
}
