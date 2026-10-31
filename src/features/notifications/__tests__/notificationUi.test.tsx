import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { NotificationProvider } from '../context/NotificationContext'
import { HeaderNotifications } from '@/components/layout/HeaderNotifications'
import { NotificationsPage } from '../pages/NotificationsPage'
import type { NotificationApi } from '../services/notificationService'
import type { Notification, NotificationPage } from '../types'

const mockAuth = vi.hoisted(() => ({
  user: { id: 1, email: 'test@expense.wiki' },
  token: 'jwt-123',
  isAuthenticated: true,
}))

const mockTenant = vi.hoisted(() => ({
  activeTenant: { id: 1, name: 'Acme Corp' },
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => mockTenant,
}))

const sampleNotification: Notification = {
  id: 101,
  userId: 1,
  type: 'PAYMENT_REMINDER',
  status: 'SENT',
  title: 'AWS Cloud Invoice',
  message: 'Payment of $120.00 is due on Nov 2',
  subjectType: 'EXPENSE',
  subjectId: 55,
  data: null,
  tenantId: 1,
  createdAt: new Date().toISOString(),
  readAt: null,
  archivedAt: null,
}

const samplePage: NotificationPage = {
  items: [sampleNotification],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
}

describe('Notification Center UI components', () => {
  let mockApi: NotificationApi

  beforeEach(() => {
    mockApi = {
      getPage: vi.fn().mockResolvedValue(samplePage),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn().mockResolvedValue({ ...sampleNotification, status: 'READ' }),
      markAsArchived: vi.fn().mockResolvedValue({ ...sampleNotification, status: 'ARCHIVED' }),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
    }
  })

  function renderWithProviders(ui: React.ReactNode) {
    return render(
      <MemoryRouter>
        <NotificationProvider api={mockApi} enableRealtime={false}>
          {ui}
        </NotificationProvider>
      </MemoryRouter>,
    )
  }

  it('renders notification bell with unread count and opens notification panel on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<HeaderNotifications />)

    // Wait for unread count to load
    const trigger = await screen.findByRole('button', { name: /Notifications \(1 unread\)/i })
    expect(trigger).toBeInTheDocument()

    // Click trigger to open notifications panel
    await user.click(trigger)

    const region = screen.getByRole('region', { name: 'Notifications' })
    expect(region).toBeInTheDocument()
    expect(within(region).getByText('AWS Cloud Invoice')).toBeInTheDocument()
    expect(within(region).getByText(/Payment of \$120\.00 is due/i)).toBeInTheDocument()
  })

  it('filters by Unread, Read and Archived tabs', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationsPage />)

    expect(await screen.findByText('AWS Cloud Invoice')).toBeInTheDocument()

    // Switch to Read tab
    mockApi.getPage = vi.fn().mockResolvedValue({
      items: [{ ...sampleNotification, id: 102, title: 'Old Paid Bill', status: 'READ' }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    })

    const readTab = screen.getByRole('tab', { name: 'Read' })
    await user.click(readTab)

    expect(mockApi.getPage).toHaveBeenCalledWith(1, { page: 0, size: 20, status: 'READ' })
    expect(await screen.findByText('Old Paid Bill')).toBeInTheDocument()
  })

  it('marks single notification as read when clicking mark-as-read button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationsPage />)

    await screen.findByText('AWS Cloud Invoice')

    const markReadBtn = screen.getByRole('button', { name: 'Mark as read' })
    await user.click(markReadBtn)

    expect(mockApi.markAsRead).toHaveBeenCalledWith(1, 101)
  })

  it('archives single notification when clicking archive button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationsPage />)

    await screen.findByText('AWS Cloud Invoice')

    const archiveBtn = screen.getByRole('button', { name: 'Archive notification' })
    await user.click(archiveBtn)

    expect(mockApi.markAsArchived).toHaveBeenCalledWith(1, 101)
  })

  it('marks all notifications as read when clicking Mark all read button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationsPage />)

    await screen.findByText('AWS Cloud Invoice')

    const markAllBtn = screen.getByRole('button', { name: /Mark all read/i })
    await user.click(markAllBtn)

    expect(mockApi.markAllAsRead).toHaveBeenCalledWith(1)
  })

  it('displays empty state when no notifications match active filter', async () => {
    mockApi.getPage = vi.fn().mockResolvedValue({
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
    })
    mockApi.getUnreadCount = vi.fn().mockResolvedValue(0)

    renderWithProviders(<NotificationsPage />)

    expect(await screen.findByText('No notifications')).toBeInTheDocument()
  })
})
