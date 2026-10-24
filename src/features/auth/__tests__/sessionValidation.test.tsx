import { useContext } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '@/api/client'
import { authService } from '../services/authService'
import { AuthContext } from '../context/context'
import { AuthProvider } from '../context/AuthContext'

function createToken(exp: number) {
  const payload = btoa(JSON.stringify({ sub: 'person@example.test', exp, tenantId: 1 }))
  return `header.${payload}.signature`
}

function renderAuthProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function SessionStatus() {
    const auth = useContext(AuthContext)
    if (!auth) throw new Error('Auth context is missing')
    return <span>{auth.isAuthenticated ? 'signed in' : 'signed out'}</span>
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><SessionStatus /></AuthProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('auth session validation', () => {
  it('logs out when the backend rejects the current session during a periodic check', async () => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    localStorage.setItem('expense_wiki_auth_token', createToken(Math.floor(Date.now() / 1000) + 3600))
    vi.spyOn(authService, 'getMe').mockRejectedValue(new ApiClientError('Unauthorized', 401))

    renderAuthProvider()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(localStorage.getItem('expense_wiki_auth_token')).toBeNull()
  })

  it('logs out when the JWT expires while the application remains open', async () => {
    vi.useFakeTimers()
    localStorage.setItem('expense_wiki_auth_token', createToken(Math.floor(Date.now() / 1000) + 30))
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      id: 1,
      email: 'person@example.test',
      currentTenantId: 1,
      defaultTenantId: 1,
      roles: [],
    })

    renderAuthProvider()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(localStorage.getItem('expense_wiki_auth_token')).toBeNull()
  })

  it('clears the session when another tab removes the stored token', () => {
    localStorage.setItem('expense_wiki_auth_token', createToken(Math.floor(Date.now() / 1000) + 3600))
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      id: 1,
      email: 'person@example.test',
      currentTenantId: 1,
      defaultTenantId: 1,
      roles: [],
    })

    renderAuthProvider()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'expense_wiki_auth_token',
        oldValue: 'previous-token',
        newValue: null,
      }))
    })

    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(localStorage.getItem('expense_wiki_auth_token')).toBeNull()
  })
})
