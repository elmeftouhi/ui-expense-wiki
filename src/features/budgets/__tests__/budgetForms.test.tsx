import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BudgetFormModal } from '../components/BudgetFormModal'
import { PeriodEditModal } from '../components/PeriodEditModal'
import { CategoryMultiSelect } from '../components/CategoryMultiSelect'
import { budget, categoryOptions, period } from './fixtures'

describe('budget form', () => {
  it('validates required inputs before submitting', async () => {
    const onSubmit = vi.fn()
    render(<BudgetFormModal isOpen onClose={vi.fn()} onSubmit={onSubmit} categoryOptions={categoryOptions} currency="USD" />)
    await userEvent.click(screen.getByRole('button', { name: 'Create budget' }))
    expect(await screen.findByText('Budget name is required.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one category to track.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('creates a budget with multiple categories and an amount warning', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<BudgetFormModal isOpen onClose={onClose} onSubmit={onSubmit} categoryOptions={categoryOptions} currency="USD" />)
    await user.type(screen.getByLabelText(/Budget name/), ' Cloud costs ')
    await user.type(screen.getByLabelText(/Allocated amount/), '500')
    await user.click(screen.getByRole('radio', { name: /Fixed amount/ }))
    await user.clear(screen.getByLabelText(/Warning threshold/))
    await user.type(screen.getByLabelText(/Warning threshold/), '400')
    await user.click(screen.getByRole('option', { name: 'Software' }))
    await user.click(screen.getByRole('option', { name: 'Hosting' }))
    await user.click(screen.getByRole('button', { name: 'Create budget' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      name: 'Cloud costs', periodicity: 'MONTHLY', allocatedAmount: 500,
      warningType: 'AMOUNT', warningThreshold: 400, categoryIds: [1, 2], active: true,
    }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('prefills edit values and preserves the form when saving fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Budget name already exists'))
    const onClose = vi.fn()
    render(<BudgetFormModal isOpen budget={budget} onClose={onClose} onSubmit={onSubmit} categoryOptions={categoryOptions} currency="USD" />)
    expect(screen.getByLabelText(/Budget name/)).toHaveValue('Cloud services')
    expect(screen.getByLabelText(/Allocated amount/)).toHaveValue(1000)
    await user.click(screen.getByRole('switch', { name: 'Active' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Budget name already exists')
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ active: false, categoryIds: [1] }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Budget name/)).toHaveValue('Cloud services')
  })

  it('rejects percentages over 100 and allows retrying failed category loads', async () => {
    const user = userEvent.setup()
    const onRetryCategories = vi.fn()
    const props = { isOpen: true, budget, onClose: vi.fn(), onSubmit: vi.fn(), categoryOptions, currency: 'USD' }
    const { rerender } = render(<BudgetFormModal {...props} categoriesError={new Error('Offline')} onRetryCategories={onRetryCategories} />)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retry categories' }))
    expect(onRetryCategories).toHaveBeenCalledOnce()
    rerender(<BudgetFormModal {...props} />)
    await user.clear(screen.getByLabelText(/Warning threshold/))
    await user.type(screen.getByLabelText(/Warning threshold/), '101')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Percentage threshold cannot exceed 100%.')).toBeInTheDocument()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('traps keyboard focus and restores it to the opener', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return <>
        <button onClick={() => setOpen(true)}>New budget</button>
        <BudgetFormModal isOpen={open} onClose={() => setOpen(false)} onSubmit={vi.fn()} categoryOptions={categoryOptions} currency="USD" />
      </>
    }
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'New budget' }))
    const close = screen.getByRole('button', { name: 'Close dialog' })
    close.focus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Create budget' })).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New budget' })).toHaveFocus()
  })
})

describe('category selection', () => {
  it('searches, selects matches and removes selections with the keyboard', async () => {
    function Harness() {
      const [value, setValue] = useState<number[]>([])
      return <CategoryMultiSelect id="categories" options={categoryOptions} value={value} onChange={setValue} />
    }
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('searchbox'), 'host')
    await user.click(screen.getByRole('button', { name: 'Select matches' }))
    expect(screen.getByRole('option', { name: 'Hosting' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'Remove Hosting' }))
    const option = screen.getByRole('option', { name: 'Hosting' })
    option.focus()
    await user.keyboard(' ')
    expect(option).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(option).toHaveAttribute('aria-selected', 'false')
  })
})

describe('period adjustment', () => {
  it('previews changes and submits only the period allocation and warning rule', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<PeriodEditModal period={period} periodLabel="October 2026" onClose={onClose} onSubmit={onSubmit} currency="USD" locale="en-US" />)
    await user.clear(screen.getByLabelText(/Allocated amount/))
    await user.type(screen.getByLabelText(/Allocated amount/), '1200')
    expect(within(screen.getByTestId('period-preview')).getByText('$350.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save period' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(10, {
      allocatedAmount: 1200, warningType: 'PERCENTAGE', warningThreshold: 80,
    }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows adjustment failures without dismissing the dialog', async () => {
    const onClose = vi.fn()
    render(<PeriodEditModal period={{ ...period, status: 'CLOSED' }} periodLabel="October 2026" onClose={onClose} onSubmit={vi.fn().mockRejectedValue(new Error('Period is locked'))} currency="USD" />)
    expect(screen.getByText(/This period is closed/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save period' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Period is locked')
    expect(onClose).not.toHaveBeenCalled()
  })
})
