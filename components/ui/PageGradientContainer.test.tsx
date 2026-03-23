import { render, screen } from '@testing-library/react'
import { PageContainer } from './PageGradientContainer'

describe('PageContainer Component', () => {
  it('renders children correctly', () => {
    render(
      <PageContainer>
        <div>Gradient Content</div>
      </PageContainer>
    )
    expect(screen.getByText('Gradient Content')).toBeInTheDocument()
  })

  it('applies custom classNames', () => {
    const { container } = render(
      <PageContainer className="custom-test-class">
        <div>Content</div>
      </PageContainer>
    )
    expect(container.firstChild).toHaveClass('custom-test-class')
  })
})