import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { BrowserRouter, Route, Routes } from 'react-router'
import IntegrationCallback from './IntegrationCallback'

const mockPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
}))

describe('IntegrationCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPost.mockReturnValue(new Promise(() => {}))
  })

  it('captures the provider response and scrubs code/state from browser history before exchange', async () => {
    window.history.replaceState(
      null,
      '',
      '/integrations/quickbooks/callback?code=secret-code&state=opaque-state&realmId=realm-1'
    )

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/integrations/:provider/callback" element={<IntegrationCallback />} />
        </Routes>
      </BrowserRouter>
    )

    expect(window.location.search).toBe('')
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/integrations/quickbooks/callback', {
        code: 'secret-code',
        state: 'opaque-state',
        realmId: 'realm-1',
      })
    })
    expect(window.location.href).not.toContain('secret-code')
    expect(window.location.href).not.toContain('opaque-state')
  })
})
