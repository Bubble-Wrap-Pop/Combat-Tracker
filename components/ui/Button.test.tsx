import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button Component', () => {
  it('renders the children text correctly', () => {
    render(<Button>Click Me</Button>)
    const buttonElement = screen.getByText('Click Me')
    expect(buttonElement).toBeInTheDocument()
  })
})