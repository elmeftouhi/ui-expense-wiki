import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryTreeSelect } from '../components/CategoryTreeSelect'
import { flattenCategoryOptions, type CategoryOption } from '@/features/budgets/utils/categoryOptions'
import type { Category } from '../types'

const options: CategoryOption[] = [
  { id: 1, name: 'Food', icon: 'Utensils', depth: 0, active: true },
  { id: 2, name: 'Groceries', depth: 1, active: true, parentName: 'Food' },
  { id: 3, name: 'Restaurants', depth: 1, active: true, parentName: 'Food' },
  { id: 4, name: 'Transport', depth: 0, active: true },
  { id: 5, name: 'Old category', depth: 0, active: false },
]

function Harness({ initial, onChange = vi.fn(), clearLabel, onEscapeOutside }: { initial?: number; onChange?: (id: number | undefined) => void; clearLabel?: string; onEscapeOutside?: () => void }) {
  const [value, setValue] = useState<number | undefined>(initial)
  return (
    <div onKeyDown={(event) => { if (event.key === 'Escape') onEscapeOutside?.() }}>
      <CategoryTreeSelect
        label="Category"
        options={options}
        value={value}
        clearLabel={clearLabel}
        onChange={(id) => { setValue(id); onChange(id) }}
      />
    </div>
  )
}

const trigger = () => screen.getByRole('button', { name: 'Category' })
const tree = () => screen.getByRole('tree', { name: 'Category' })

describe('CategoryTreeSelect', () => {
  it('orders roots and children by saved level in the dropdown rather than alphabetically', async () => {
    const user = userEvent.setup()
    const categories: Category[] = [
      { id: 1, name: 'Alpha', level: 2, active: true, allowOverBudget: false },
      { id: 2, name: 'Zulu', level: 1, active: true, allowOverBudget: false, subCategories: [
        { id: 3, name: 'Alpha child', level: 2, active: true, allowOverBudget: false },
        { id: 4, name: 'Zulu child', level: 1, active: true, allowOverBudget: false },
      ] },
    ]
    const ordered = flattenCategoryOptions(categories)
    expect(ordered.map(({ id, depth }) => [id, depth])).toEqual([[2, 0], [4, 1], [3, 1], [1, 0]])
    render(<CategoryTreeSelect label="Category" options={ordered} onChange={vi.fn()} />)
    await user.click(trigger())
    expect(within(tree()).getAllByRole('treeitem').map((item) => item.getAttribute('aria-label'))).toEqual(['Zulu', 'Alpha'])
    await user.click(within(tree()).getByRole('treeitem', { name: 'Zulu' }).querySelector('[title="Expand"]')!)
    expect(within(tree()).getAllByRole('treeitem').map((item) => item.getAttribute('aria-label')))
      .toEqual(['Zulu', 'Zulu child', 'Alpha child', 'Alpha'])
  })

  it('orders flat category siblings by level and keeps ties and missing levels stable', () => {
    const make = (id: number, level?: number, parentCategoryId?: number): Category => ({
      id, name: `Category ${id}`, level, parentCategoryId, active: true, allowOverBudget: false,
    })
    expect(flattenCategoryOptions([
      make(8), make(6, 2, 1), make(2, 2), make(1, 1),
      make(5, 1, 1), make(7, 1, 1), make(9),
    ]).map(({ id }) => id)).toEqual([1, 5, 7, 6, 2, 8, 9])
  })

  it('opens a collapsed tree and expands or collapses a parent with its chevron', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    const food = within(tree()).getByRole('treeitem', { name: 'Food' })
    expect(food).toHaveAttribute('aria-expanded', 'false')
    expect(within(tree()).queryByRole('treeitem', { name: 'Groceries' })).not.toBeInTheDocument()
    expect(within(tree()).getByRole('treeitem', { name: 'Old category (inactive)' })).toBeInTheDocument()

    await user.click(food.querySelector('[title="Expand"]')!)
    expect(food).toHaveAttribute('aria-expanded', 'true')
    expect(within(tree()).getByRole('treeitem', { name: 'Groceries' })).toHaveAttribute('aria-level', '2')
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')

    await user.click(food.querySelector('[title="Collapse"]')!)
    expect(within(tree()).queryByRole('treeitem', { name: 'Groceries' })).not.toBeInTheDocument()
  })

  it('selects a parent category', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(trigger())
    await user.click(within(tree()).getByRole('treeitem', { name: 'Food' }))
    expect(onChange).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    expect(trigger()).toHaveTextContent('Food')
    expect(trigger()).toHaveFocus()
  })

  it('selects a subcategory and shows its parent path on the trigger', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(trigger())
    await user.click(within(tree()).getByRole('treeitem', { name: 'Food' }).querySelector('[title="Expand"]')!)
    await user.click(within(tree()).getByRole('treeitem', { name: 'Restaurants' }))
    expect(onChange).toHaveBeenCalledWith(3)
    expect(trigger()).toHaveTextContent('Restaurants in Food')
  })

  it('reveals the selected subcategory when reopened', async () => {
    const user = userEvent.setup()
    render(<Harness initial={2} />)
    await user.click(trigger())
    expect(within(tree()).getByRole('treeitem', { name: 'Food' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(tree()).getByRole('treeitem', { name: 'Groceries' })).toHaveAttribute('aria-selected', 'true')
  })

  it('search shows matching subcategories with their parents expanded', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(trigger())
    await user.type(screen.getByRole('searchbox', { name: 'Search categories' }), 'rest')
    const items = within(tree()).getAllByRole('treeitem')
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['Food', 'Restaurants'])
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('tells the user when no category matches', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByRole('status')).toHaveTextContent('No matching categories')
  })

  it('offers a clear option for filters', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={4} clearLabel="All categories" onChange={onChange} />)
    expect(trigger()).toHaveTextContent('Transport')
    await user.click(trigger())
    await user.click(within(tree()).getByRole('treeitem', { name: 'All categories' }))
    expect(onChange).toHaveBeenCalledWith(undefined)
    expect(trigger()).toHaveTextContent('All categories')
  })

  it('supports keyboard navigation to expand, collapse, and select', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('searchbox')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    const food = within(tree()).getByRole('treeitem', { name: 'Food' })
    expect(food).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(food).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowRight}')
    expect(within(tree()).getByRole('treeitem', { name: 'Groceries' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(food).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(food).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('closes on Escape without letting the key reach a surrounding dialog', async () => {
    const user = userEvent.setup()
    const onEscapeOutside = vi.fn()
    render(<Harness onEscapeOutside={onEscapeOutside} />)
    await user.click(trigger())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
    expect(onEscapeOutside).not.toHaveBeenCalled()
  })

  it('preserves category icons when flattening API categories', () => {
    expect(flattenCategoryOptions([{
      id: 1, name: 'Food', icon: 'Utensils', active: true, allowOverBudget: false,
    }])[0]).toMatchObject({ icon: 'Utensils' })
  })
})
