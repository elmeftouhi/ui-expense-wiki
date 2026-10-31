import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryFormModal } from '../components/CategoryFormModal'
import { AVAILABLE_CATEGORY_ICONS, ICON_MAP } from '../components/categoryIcons'
import {
  CATEGORY_COLORS,
  deriveCategoryColorPair,
  resolveCategoryColor,
} from '../components/colorPalette'
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

describe('category color palette & custom picker', () => {
  it('provides 16 distinct preset swatches and derives readable custom tint pairs', () => {
    expect(CATEGORY_COLORS).toHaveLength(16)
    expect(new Set(CATEGORY_COLORS.map((c) => c.label)).size).toBe(16)
    expect(new Set(CATEGORY_COLORS.map((c) => c.textColor)).size).toBe(16)

    const richBrand = deriveCategoryColorPair('#1E3A8A')
    expect(richBrand.textColor).toBe('#1E3A8A')
    expect(richBrand.backgroundColor).toMatch(/^#[0-9A-F]{6}$/)
    expect(richBrand.isCustom).toBe(true)

    // Bright yellow gets darkened automatically so text/icon remains readable on a soft pastel background
    const brightYellow = deriveCategoryColorPair('#FFEE00')
    expect(brightYellow.textColor).not.toBe('#FFEE00')
    expect(brightYellow.backgroundColor).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('allows picking a custom hex color with auto-generated soft background tint', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<CategoryFormModal isOpen onClose={vi.fn()} onSubmit={submit} />)

    await user.click(screen.getByRole('radio', { name: 'Custom color' }))
    const hexInput = screen.getByLabelText('Custom hex color')
    await user.clear(hexInput)
    await user.type(hexInput, '#9333EA')

    const expected = deriveCategoryColorPair('#9333EA')
    await user.type(screen.getByPlaceholderText(/Cloud Infrastructure/), 'Creative')
    await user.click(screen.getByRole('button', { name: 'Create Category' }))

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Creative',
        textColor: expected.textColor,
        backgroundColor: expected.backgroundColor,
      }),
    )
  })

  it('preserves custom saved colors when editing an existing category', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue(undefined)
    const customCat: Category = {
      id: 9,
      name: 'Brand Events',
      textColor: '#B42318',
      backgroundColor: '#FEF3F2',
      active: true,
      allowOverBudget: false,
    }
    expect(resolveCategoryColor(customCat.textColor, customCat.backgroundColor).isCustom).toBe(true)

    render(<CategoryFormModal isOpen onClose={vi.fn()} onSubmit={submit} category={customCat} />)
    expect(screen.getByRole('radio', { name: 'Custom color' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Custom hex color')).toHaveValue('#B42318')

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        textColor: '#B42318',
        backgroundColor: '#FEF3F2',
      }),
    )
  })
})
