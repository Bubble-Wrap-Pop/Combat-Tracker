import { render, screen } from '@testing-library/react'
import { AvatarInput } from './AvatarSelection'

beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => 'mocked-url')
})

describe('AvatarInput Component', () => {
  it('renders the No Image placeholder when no url is provided', () => {
    render(<AvatarInput />)
    expect(screen.getByText('No Image')).toBeInTheDocument()
  })

  it('renders an image when existingAvatarUrl is provided', () => {
    render(<AvatarInput existingAvatarUrl="https://example.com/avatar.png" />)
    const img = screen.getByAltText('Profile Preview')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png')
  })
  
  it('renders the hidden inputs correctly', () => {
    const { container } = render(<AvatarInput existingAvatarUrl="https://example.com/avatar.png" />)
    const hiddenInput = container.querySelector('input[name="existing_avatar_url"]')
    expect(hiddenInput).toHaveValue('https://example.com/avatar.png')
  })
})