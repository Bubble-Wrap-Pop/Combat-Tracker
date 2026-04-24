import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase-database'

export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}