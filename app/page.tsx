export const dynamic = 'force-dynamic';

import { createSupabaseServerClient } from '@/utils/supabase/server';
import { PageContainer } from '@/components/ui/PageGradientContainer';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <PageContainer className="flex flex-col items-center justify-center">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center px-4 sm:px-8 text-center">
        <Image src="/UmbralSanctuaryLogo.png" alt="Umbral Sanctuary" width={200} height={200} className="mb-6" />
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-5xl md:text-7xl">
          Umbral Sanctuary
        </h1>
        
        <p className="mb-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 sm:text-xl">
        A synchronized live combat and initiative tracker for tabletop roleplaying games. Manage encounters, process attacks, and analyze the battlefield in real time.
        </p>

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:gap-6">
          {user ? (
            <Button href="/dashboard" className="w-full sm:w-auto">
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button href="/login" className="w-full sm:w-auto">
                Log In
              </Button>
              <Button href="/signup" variant="outline" className="w-full sm:w-auto">
                Sign Up
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 w-full mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-16">
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Real Time State</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Synchronized combat dashboard for Game Masters and players.</p>
          </div>
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Direct Attacks</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Peer to peer resolution system for instant damage calculation.</p>
          </div>
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Tactical Assessment</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">AI driven narrative summaries of enemy combat conditions.</p>
          </div>
        </div>

      </main>
    </PageContainer>
  );
}
