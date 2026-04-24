export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/PageGradientContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AvatarInput } from "@/components/client/AvatarSelection";

export default async function EditProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const updateProfile = async (formData: FormData) => {
    "use server";
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const fullName = formData.get("full_name") as string;
    const removeAvatar = formData.get("remove_avatar") === "true";
    let avatarUrl = formData.get("existing_avatar_url") as string;
    const avatarFile = formData.get("avatar_file") as File;

    if (removeAvatar) {
      avatarUrl = "";
    } else if (avatarFile && avatarFile.size > 0) {
      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `${user?.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      avatarUrl = data.publicUrl;
    }

    const updates = {
      avatar_url: avatarUrl,
      full_name: fullName,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user?.id);
    if (error) throw error;

    redirect("/profile");
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-zinc-200/70 pb-4 dark:border-zinc-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="truncate text-3xl font-bold text-zinc-900 dark:text-white">
                Edit profile
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Update how you appear in the app.
              </p>
            </div>
            <Button href="/profile" variant="outline" className="w-full shrink-0 sm:w-auto">
              Back to profile
            </Button>
          </div>
        </header>

        <main>
          <Card className="p-6 sm:p-8">
            <form action={updateProfile} className="flex max-w-2xl flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Email (read only)</label>
                <input
                  value={user.email}
                  disabled
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-100 p-3 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="full_name" className="text-sm font-medium">
                  Full name
                </label>
                <input
                  type="text"
                  name="full_name"
                  id="full_name"
                  className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
                  placeholder="Enter your full name"
                  defaultValue={profile?.full_name || ""}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="avatar_file" className="text-sm font-medium">
                  Profile picture
                </label>
                <AvatarInput existingAvatarUrl={profile?.avatar_url} />
              </div>

              <Button type="submit" className="mt-2 w-full sm:w-auto">
                Save changes
              </Button>
            </form>
          </Card>
        </main>
      </div>
    </PageContainer>
  );
}
