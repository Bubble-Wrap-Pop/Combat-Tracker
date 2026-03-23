import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'

export default async function SignupPage(props: { 
  searchParams: Promise<{ error?: string, message?: string }> 
}) {
  const searchParams = await props.searchParams

  const signup = async (formData: FormData) => {
    'use server'
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    const supabase = await createSupabaseServerClient()
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return redirect('/signup?error=' + encodeURIComponent(error.message))
    }

    return redirect('/login?message=' + encodeURIComponent('Account created successfully. Please check your email for verification.'))
  }

  return (
    <AuthForm
      title="Create Account"
      error={searchParams.error}
      message={searchParams.message}
      submitLabel="Sign Up"
      footer={
        <p className="text-center text-sm mt-4 text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-500 hover:underline">
            Log in
          </Link>
        </p>
      }
      action={signup}
    />
  )
}