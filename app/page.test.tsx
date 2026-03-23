import { render, screen } from '@testing-library/react'
import HomePage from './page'

// Mock the Supabase server client to simulate a logged-out user
jest.mock('@/utils/supabase/server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}))

describe('Home Page', () => {
  it('renders the main heading', async () => {
    // Await the async server component before rendering it
    const ResolvedHome = await HomePage()
    render(ResolvedHome)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent(/Next.js \+ Supabase/i)
  })

  it('renders the login and signup links', async () => {
    const ResolvedHome = await HomePage()
    render(ResolvedHome)
    
    expect(screen.getByRole('link', { name: /Log In/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sign Up/i })).toBeInTheDocument()
  })
})