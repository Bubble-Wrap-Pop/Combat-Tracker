import { createSupabaseClient } from './client'
import { createBrowserClient } from '@supabase/ssr'

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
}))

describe('Supabase Client Utility', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('creates a Supabase client with the correct environment variables', () => {
    createSupabaseClient()
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://test-supabase.co',
      'test-anon-key'
    )
  })
})