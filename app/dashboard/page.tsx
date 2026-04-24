export const dynamic = 'force-dynamic';

import { createSupabaseServerClient } from '@/utils/supabase/server'
import type { Tables } from '@/lib/supabase-database'
import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageGradientContainer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  // Requirement: Create protected routes that require authentication
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileRow as Tables<'profiles'> | null

  const { count: gmSessionCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('game_master_id', user.id)

  const { count: joinedSessionCount } = await supabase
    .from('session_players')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', user.id)

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
      <header className="mb-8 pb-4 border-b border-zinc-200/70 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white truncate">Command Center</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Launch encounters, join active combats, and manage your account.
            </p>
          </div>
        </header>

        <main className="grid gap-6">
          <Card className="p-6 bg-gradient-to-br from-zinc-100/70 via-white to-zinc-100/40 dark:from-zinc-900/70 dark:via-zinc-900 dark:to-zinc-800/40">
            <h2 className="text-2xl font-semibold mb-2 text-zinc-900 dark:text-white">Live Combat Hub</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Choose your role to continue. Game Masters control initiative and vitals, while players stay synced in real time.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button href="/gm" className="w-full h-11">Open GM Console</Button>
              <Button href="/player" variant="outline" className="w-full h-11">Open Player View</Button>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Combat snapshot</h3>
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p><span className="font-medium text-zinc-900 dark:text-zinc-300">Combats you run:</span> {gmSessionCount ?? 0}</p>
              <p><span className="font-medium text-zinc-900 dark:text-zinc-300">Combats you joined:</span> {joinedSessionCount ?? 0}</p>
              <p><span className="font-medium text-zinc-900 dark:text-zinc-300">Last Sign In:</span> {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'First login'}</p>
            </div>
          </Card>

          <Card className="flex flex-col justify-between p-5">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Account</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Signed in as {profile?.full_name || user.email}
              </p>
            </div>
            <Button href="/profile" variant="outline" className="mt-4">
              View profile
            </Button>
          </Card>
          </div>
        </main>
      </div>
    </PageContainer>
  )
}