import { createSupabaseServerClient } from './server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

describe('Supabase Server Utility', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-server-supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-server-anon-key'
    
    ;(cookies as jest.Mock).mockReturnValue({
      getAll: jest.fn(),
      setAll: jest.fn(),
    })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('creates a Supabase server client with cookies', async () => {
    await createSupabaseServerClient()
    expect(createServerClient).toHaveBeenCalledWith(
      'https://test-server-supabase.co',
      'test-server-anon-key',
      expect.any(Object)
    )
  })
})