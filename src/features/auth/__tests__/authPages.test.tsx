import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { authStorage } from '../services/authStorage'

const mockLogin = vi.fn()
const mockRegister = vi.fn()

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    login: mockLogin,
    register: mockRegister,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders a simple and clean login form without unnecessary explanation or text', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    // Check essential elements
    expect(screen.getByRole('heading', { name: /Sign In/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Remember credentials/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create Account/i })).toBeInTheDocument()

    // Ensure removed unnecessary text / explanation is NOT present
    expect(screen.queryByText(/Multi-Tenant Expense Management/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Enter your corporate credentials/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Secure JWT Bearer Authentication/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Fill Demo Credentials/i)).not.toBeInTheDocument()
  })

  it('saves credentials when "Remember credentials" is checked and logs in', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'mock-token', selectedTenantId: 1 })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/Email/i)
    const passwordInput = screen.getByLabelText(/^Password/i)
    const rememberCheckbox = screen.getByLabelText(/Remember credentials/i)
    const submitBtn = screen.getByRole('button', { name: /Sign In/i })

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } })
    fireEvent.click(rememberCheckbox)

    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Secret123!',
      })
    })

    const saved = authStorage.getRememberedCredentials()
    expect(saved).toEqual({
      email: 'user@example.com',
      password: 'Secret123!',
      remember: true,
    })
  })

  it('pre-populates credentials if remembered credentials exist', () => {
    authStorage.setRememberedCredentials({
      email: 'saved@example.com',
      password: 'SavedPassword1!',
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement
    const rememberCheckbox = screen.getByLabelText(/Remember credentials/i) as HTMLInputElement

    expect(emailInput.value).toBe('saved@example.com')
    expect(passwordInput.value).toBe('SavedPassword1!')
    expect(rememberCheckbox.checked).toBe(true)
  })

  it('clears remembered credentials when submitted with the checkbox unchecked', async () => {
    authStorage.setRememberedCredentials({
      email: 'saved@example.com',
      password: 'SavedPassword1!',
    })
    mockLogin.mockResolvedValueOnce({ accessToken: 'mock-token', selectedTenantId: 1 })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const rememberCheckbox = screen.getByLabelText(/Remember credentials/i)
    fireEvent.click(rememberCheckbox) // Uncheck

    const submitBtn = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
    })

    expect(authStorage.getRememberedCredentials()).toBeNull()
  })
})

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders a simple and clean registration form without unnecessary explanations', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    // Essential elements
    expect(screen.getByRole('heading', { name: /Create Account/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Remember credentials/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument()

    // Ensure unnecessary explanations are gone
    expect(screen.queryByText(/Create your new organization workspace/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Configure your workspace parameters/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Automatic Tenant Provisioning/i)).not.toBeInTheDocument()
  })
})
