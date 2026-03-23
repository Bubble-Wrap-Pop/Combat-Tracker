import { render, screen } from '@testing-library/react'
import { AuthForm } from './AuthForm'

describe('AuthForm Component', () => {
  it('renders the authentication form elements correctly', () => {
    const mockAction = jest.fn()
    
    render(
      <AuthForm 
        title="Secure Login" 
        submitLabel="Sign In" 
        footer={<div>Help Text</div>} 
        action={mockAction}
      />
    )
    
    expect(screen.getByText('Secure Login')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByText('Help Text')).toBeInTheDocument()
  })

  it('renders error and success messages when provided', () => {
    render(
      <AuthForm 
        title="Secure Login" 
        submitLabel="Sign In" 
        footer={<div />} 
        action={jest.fn()}
        error="Invalid login credentials"
        message="Check your email for a reset link"
      />
    )
    
    expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    expect(screen.getByText('Check your email for a reset link')).toBeInTheDocument()
  })
})