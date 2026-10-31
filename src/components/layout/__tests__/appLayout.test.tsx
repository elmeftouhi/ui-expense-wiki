import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../AppShell'

const logoutMock = vi.fn(async () => {})
const switchTenantMock = vi.fn<(id: number) => Promise<void>>(async () => {})

const authMock = vi.hoisted(() => ({
  user: {
    id: 1,
    email: 'alex@expense.wiki',
    displayedName: 'Alex Morgan',
    firstName: 'Alex',
    lastName: 'Morgan',
  },
  isAuthenticated: true,
  isLoading: false,
  logout: () => logoutMock(),
}))

const tenantStateMock = vi.hoisted(() => ({
  activeTenant: {
    id: 1,
    name: 'Acme Studio',
    slug: 'acme-studio',
    currency: 'EUR',
    locale: 'en-GB',
    role: 'ADMIN' as const,
  },
  availableTenants: [
    {
      id: 1,
      name: 'Acme Studio',
      slug: 'acme-studio',
      currency: 'EUR',
      locale: 'en-GB',
      role: 'ADMIN' as const,
    },
    {
      id: 2,
      name: 'Personal Ledger',
      slug: 'personal-ledger',
      currency: 'USD',
      locale: 'en-US',
      role: 'EDITOR' as const,
    },
  ],
  currentRole: 'ADMIN' as const,
  isAdmin: true,
  canEdit: true,
  isSwitching: false,
  switchTenant: (id: number) => switchTenantMock(id),
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/features/tenants/context/useActiveTenant', () => ({
  useActiveTenant: () => tenantStateMock,
}))

function RouteProbe() {
  const location = useLocation()
  return (
    <div data-testid="route-probe">
      {location.pathname}
      {location.search}
    </div>
  )
}

function renderShell(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<RouteProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell, Header, and Sidebar layout', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    logoutMock.mockClear()
    switchTenantMock.mockClear()
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('renders clean sidebar navigation without scaffold or duplicate tenant cards and persists collapse state', async () => {
    const user = userEvent.setup()
    renderShell('/')

    const sidebar = screen.getByLabelText('Primary navigation')
    expect(within(sidebar).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Expenses' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Budgets' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Subscriptions' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Categories' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Receipts' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Workspaces' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Settings' })).toBeInTheDocument()

    expect(screen.queryByText(/Frontend Scaffold/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Multi-Tenant Platform/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Active Tenant/i)).not.toBeInTheDocument()

    const collapseBtn = within(sidebar).getByRole('button', { name: 'Collapse sidebar' })
    await user.click(collapseBtn)

    expect(localStorage.getItem('expense_wiki_sidebar_collapsed')).toBe('true')
    expect(within(sidebar).getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('opens search via Ctrl+K without fake pre-seeded history and navigates to expenses on Enter', async () => {
    const user = userEvent.setup()
    renderShell('/')

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    const dialog = screen.getByRole('dialog', { name: 'Search expenses' })
    expect(within(dialog).queryByText(/Travel expenses Q3/i)).not.toBeInTheDocument()

    const input = within(dialog).getByPlaceholderText(/Search merchant, note, or reference/i)
    await user.type(input, 'Cloudflare{Enter}')

    expect(screen.getByTestId('route-probe')).toHaveTextContent('/expenses?search=Cloudflare')
    expect(screen.queryByRole('dialog', { name: 'Search expenses' })).not.toBeInTheDocument()

    // Reopen search and confirm recent query was persisted
    await user.click(screen.getByRole('button', { name: 'Search expenses' }))
    expect(screen.getByText('Cloudflare')).toBeInTheDocument()
  })

  it('switches light/dark theme and provides deduplicated account menu actions', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(screen.getByRole('button', { name: /Account menu for Alex Morgan/i }))
    const menu = screen.getByRole('menu', { name: 'Account menu' })

    expect(within(menu).getByText('alex@expense.wiki')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Workspace settings' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Manage workspaces' })).toBeInTheDocument()
    expect(within(menu).queryByText('Account Profile')).not.toBeInTheDocument()

    const darkButton = within(menu).getByRole('button', { name: 'Dark' })
    await user.click(darkButton)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('expense_wiki_theme')).toBe('dark')

    const lightButton = within(menu).getByRole('button', { name: 'Light' })
    await user.click(lightButton)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('expense_wiki_theme')).toBe('light')
  })

  it('marks notifications as read and removes broken /dashboard footer link', async () => {
    const user = userEvent.setup()
    renderShell('/')

    const bell = screen.getByRole('button', { name: /Notifications \(3 unread\)/i })
    await user.click(bell)

    const region = screen.getByRole('region', { name: 'Notifications' })
    expect(within(region).queryByText(/View all notifications/i)).not.toBeInTheDocument()

    await user.click(within(region).getByRole('button', { name: /Mark all read/i }))
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('opens mobile navigation drawer and closes it on Escape', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' })
    expect(within(drawer).getByRole('link', { name: 'Budgets' })).toBeInTheDocument()
    expect(within(drawer).queryByText(/Multi-tenant scaffold/i)).not.toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument()
  })
})
