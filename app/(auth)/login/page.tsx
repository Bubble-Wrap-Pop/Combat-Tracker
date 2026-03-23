import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'

export default async function LoginPage(props: { 
  searchParams: Promise<{ error?: string, message?: string }> 
}) {
  const searchParams = await props.searchParams

  const login = async (formData: FormData) => {
    'use server'
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    const supabase = await createSupabaseServerClient()
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return redirect('/login?error=' + encodeURIComponent(error.message))
    }

    return redirect('/dashboard')
  }

  return (
    <AuthForm
      title="Log In"
      error={searchParams.error}
      message={searchParams.message}
      submitLabel="Log In"
      footer={
        <p className="text-center text-sm mt-4 text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-500 hover:underline">
            Sign up
          </Link>
        </p>
      }
      action={login}
    />
  )
}