import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageGradientContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AvatarInput } from '@/components/client/AvatarSelection'

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch existing profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const updateProfile = async (formData: FormData) => {
    'use server'
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const fullName = formData.get('full_name') as string;

    const removeAvatar = formData.get('remove_avatar') === 'true';
    let avatarUrl = formData.get('existing_avatar_url') as string;
    const avatarFile = formData.get('avatar_file') as File;

    if (removeAvatar) {
      avatarUrl = '';
    } else if (avatarFile && avatarFile.size > 0) {
      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `${user?.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile);
        
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      avatarUrl = data.publicUrl;
    }

    const updates = {
      avatar_url: avatarUrl,
      full_name: fullName,
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user?.id)
    if (error) throw error
    
    redirect('/dashboard')
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto">
        <Card>
          <div className="flex items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">Edit Profile</h1>
            <Button href="/dashboard" variant="outline" className="!px-4 !py-2 shrink-0">
              Back to Dashboard
            </Button>
          </div>

          <form action={updateProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Email (Read Only)</label>
              <input value={user.email} disabled className="border border-zinc-300 dark:border-zinc-700 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 w-full" />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="full_name" className="text-sm font-medium">Full Name</label>
              <input type="text" name="full_name" id="full_name" className="border border-zinc-300 dark:border-zinc-700 p-2 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white w-full placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder='Enter your full name' defaultValue={profile?.full_name || ''} />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="avatar_file" className="text-sm font-medium">Profile Picture</label>
              <AvatarInput existingAvatarUrl={profile?.avatar_url} />
            </div>

            <Button type="submit" className="mt-4 w-full">
              Save Changes
            </Button>
          </form>
        </Card>
      </div>
    </PageContainer>
  )
}