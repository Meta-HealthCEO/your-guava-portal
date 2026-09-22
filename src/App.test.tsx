import { useContext } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, useLocation, useNavigate } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RouteFocusContext } from '@/components/layout/AppLayout'
import { RouteFocusProvider } from './App'

function Probe() {
  const { shouldFocusMain, announcePage } = useContext(RouteFocusContext)
  const navigate = useNavigate()

  return (
    <>
      <span data-testid="should-focus">{String(shouldFocusMain)}</span>
      <button type="button" onClick={() => navigate('/planning')}>
        Go to planning
      </button>
      <button type="button" onClick={() => announcePage('Planning')}>
        Announce
      </button>
    </>
  )
}

function RedirectingEntry() {
  const { pathname } = useLocation()
  if (pathname === '/') return <Navigate to="/today" replace />
  return <Probe />
}

function renderProvider(initialEntry: string, children = <Probe />) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RouteFocusProvider>{children}</RouteFocusProvider>
    </MemoryRouter>
  )
}

describe('RouteFocusProvider', () => {
  it('does not ask the shell to take focus on the first paint', () => {
    renderProvider('/today')

    expect(screen.getByTestId('should-focus')).toHaveTextContent('false')
  })

  it('asks the shell to take focus once the route changes', async () => {
    const user = userEvent.setup()
    renderProvider('/today')

    await user.click(screen.getByRole('button', { name: 'Go to planning' }))

    expect(screen.getByTestId('should-focus')).toHaveTextContent('true')
  })

  it('treats an entry-URL redirect as part of the first paint', () => {
    renderProvider('/', <RedirectingEntry />)

    expect(screen.getByTestId('should-focus')).toHaveTextContent('false')
  })

  it('announces the page politely without disturbing the visible layout', async () => {
    const user = userEvent.setup()
    renderProvider('/today')

    const announcer = screen.getByRole('status')
    expect(announcer).toHaveAttribute('aria-live', 'polite')
    expect(announcer.className).toContain('sr-only')
    expect(announcer).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Announce' }))

    expect(screen.getByRole('status')).toHaveTextContent('Planning')
  })
})
