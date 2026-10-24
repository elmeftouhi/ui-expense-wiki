import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryFormModal } from '../components/CategoryFormModal'
import { AVAILABLE_CATEGORY_ICONS, ICON_MAP } from '../components/categoryIcons'
import type { Category } from '../types'

const legacyIconNames = [
  'Tag', 'Server', 'Laptop', 'Building', 'Plane', 'Coffee', 'Briefcase', 'Megaphone', 'ShoppingBag', 'Shield',
  'Users', 'CreditCard', 'Phone', 'Car', 'FileText', 'GraduationCap', 'Globe', 'Wrench', 'Flame', 'FolderTree',
]

describe('category icon picker', () => {
  it('offers a larger catalogue without duplicates and keeps every previously saved icon', () => {
    const names = AVAILABLE_CATEGORY_ICONS.map((item) => item.name)
    expect(names.length).toBeGreaterThan(80)
    expect(new Set(names).size).toBe(names.length)
    legacyIconNames.forEach((name) => expect(ICON_MAP[name]).toBeDefined())
  })

  it('groups icons, filters them by search, and submits the chosen icon', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<CategoryFormModal isOpen onClose={vi.fn()} onSubmit={submit} />)
    expect(screen.getByRole('group', { name: 'Food & drink' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Icon Symbol'), 'pets')
    expect(screen.queryByRole('group', { name: 'Food & drink' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pets' }))
    expect(screen.getByRole('button', { name: 'Pets' })).toHaveAttribute('aria-pressed', 'true')

    await user.clear(screen.getByLabelText('Icon Symbol'))
    await user.type(screen.getByLabelText('Icon Symbol'), 'zzz')
    expect(screen.getByRole('status')).toHaveTextContent('No icons match')

    await user.type(screen.getByPlaceholderText(/Cloud Infrastructure/), 'Animals')
    await user.click(screen.getByRole('button', { name: 'Create Category' }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Animals', icon: 'PawPrint' }))
  })

  it('preselects the saved icon when editing', () => {
    const category = { id: 1, name: 'Pets', icon: 'Dog', active: true, allowOverBudget: false } as Category
    render(<CategoryFormModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} category={category} />)
    expect(screen.getByRole('button', { name: 'Dog' })).toHaveAttribute('aria-pressed', 'true')
  })
})
