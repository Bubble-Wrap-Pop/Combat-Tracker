import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card Component', () => {
  it('renders the children content correctly', () => {
    render(<Card>Test Card Content</Card>)
    const cardElement = screen.getByText('Test Card Content')
    expect(cardElement).toBeInTheDocument()
  })
})