import { createSupabaseServerClient } from '@/utils/supabase/server';
import { PageContainer } from '@/components/ui/PageGradientContainer';
import { Button } from '@/components/ui/Button';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <PageContainer className="flex flex-col items-center justify-center">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center px-4 sm:px-8 text-center">
        
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-5xl md:text-7xl">
          Next.js + Supabase
        </h1>
        
        <p className="mb-10 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 sm:text-xl">
          A production ready starter application featuring secure authentication, automated database migrations, and built in user profiles.
        </p>

        <div className="mb-16 flex flex-col gap-4 sm:flex-row sm:gap-6">
          {user ? (
            <Button href="/dashboard" className="sm:w-auto">
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
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Authentication</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Complete login and signup flows protected by Supabase Auth.</p>
          </div>
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Database security</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Row Level Security enabled by default to keep user data private.</p>
          </div>
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">User Profiles</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Automatic profile creation and avatar uploading built right in.</p>
          </div>
        </div>

      </main>
    </PageContainer>
  );
}
