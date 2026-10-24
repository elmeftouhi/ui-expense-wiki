import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { CategoriesPage } from '../pages/CategoriesPage'
import { CategoryFormModal } from '../components/CategoryFormModal'
import { categoryService } from '../services/categoryService'
import { organizeCategories } from '../utils/categoryOrder'
import type { Category } from '../types'
import { DEFAULT_CORPORATE_CATEGORIES } from '../data/defaultCategories'
import { ToastProvider } from '@/components/ui/toaster'

const tenant = vi.hoisted(() => ({ id: 1, canEdit: true }))
vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: tenant.id, name: 'Test workspace', currency: 'USD', locale: 'en-US' },
    canEdit: tenant.canEdit, currentRole: tenant.canEdit ? 'ADMIN' : 'VIEWER',
  }),
}))

const category = (id: number, name: string, level: number, parentCategoryId?: number): Category => ({
  id, name, level, parentCategoryId, active: true, allowOverBudget: false,
})
const fixtures = () => [
  category(2, 'Travel', 2), category(4, 'Internet', 2, 1),
  category(1, 'Office', 1), category(3, 'Rent', 1, 1),
  category(5, 'Flights', 1, 2),
]
let client: QueryClient
let data: Category[]

beforeEach(() => {
  tenant.id = 1
  tenant.canEdit = true
  data = fixtures()
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.spyOn(categoryService, 'getAll').mockImplementation(async () => data)
  vi.spyOn(categoryService, 'updateLevel').mockImplementation(async (id, level) => {
    const moved = data.find((item) => item.id === id)!
    const siblings = data.filter((item) => (item.parentCategoryId ?? null) === (moved.parentCategoryId ?? null))
      .sort((a, b) => a.level! - b.level!)
    siblings.splice(siblings.indexOf(moved), 1)
    siblings.splice(level - 1, 0, moved)
    data = data.map((item) => {
      const position = siblings.findIndex((sibling) => sibling.id === item.id)
      return position < 0 ? item : { ...item, level: position + 1 }
    })
  })
})
afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

function tree() {
  return <QueryClientProvider client={client}><ToastProvider><CategoriesPage /></ToastProvider></QueryClientProvider>
}
const groups = () => screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))

function dragFrom(name: string) {
  const handle = screen.getByRole('button', { name: `Drag to reorder ${name}` })
  const dataTransfer = {
    effectAllowed: '', dropEffect: '', setData: vi.fn(), setDragImage: vi.fn(),
  }
  fireEvent.dragStart(handle, { dataTransfer })
  return { handle, dataTransfer }
}

function dropOn(name: string, edge: 'before' | 'after', dataTransfer: ReturnType<typeof dragFrom>['dataTransfer']) {
  const row = screen.getByRole('button', { name: `Drag to reorder ${name}` }).closest<HTMLElement>('[data-category-row]')!
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
    top: 100, bottom: 200, height: 100, left: 0, right: 400, width: 400, x: 0, y: 100, toJSON: () => ({}),
  })
  const dispatch = (kind: 'dragOver' | 'drop') => {
    const event = createEvent[kind](row, { dataTransfer })
    Object.defineProperty(event, 'clientY', { value: edge === 'before' ? 110 : 190 })
    fireEvent(row, event)
  }
  dispatch('dragOver')
  return { row, drop: () => dispatch('drop') }
}

describe('category ordering', () => {
  it('starts collapsed and supports individual and bulk expansion for read-only members', async () => {
    tenant.canEdit = false
    render(tree())
    const office = await screen.findByRole('button', { name: 'Expand Office subcategories' })
    expect(office).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Rent')).not.toBeInTheDocument()
    expect(screen.queryByText('Flights')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeDisabled()

    await userEvent.click(office)
    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.queryByText('Flights')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Office subcategories' }))
    expect(screen.queryByText('Rent')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('Internet')).toBeInTheDocument()
    expect(screen.getByText('Flights')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryByText('Rent')).not.toBeInTheDocument()
    expect(screen.queryByText('Flights')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTitle('Card Grid View'))
    expect(screen.queryByRole('button', { name: 'Expand all' })).not.toBeInTheDocument()
    expect(screen.getByText('Rent')).toBeInTheDocument()
    await userEvent.click(screen.getByTitle('Hierarchical Tree View'))
    expect(screen.queryByText('Rent')).not.toBeInTheDocument()
  })

  it('shows compact floating success feedback outside the page flow', async () => {
    render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await userEvent.click(screen.getByRole('button', { name: 'Move Office down' }))
    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('Category "Office" reordered.')
    expect(notice.parentElement).toHaveClass('fixed', 'bottom-4', 'right-4', 'max-w-sm')
    expect(screen.getByRole('heading', { name: 'Categories' }).closest('.space-y-6')).not.toContainElement(notice)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('places the grip first and carries a full-width row preview at the cursor', async () => {
    const view = render(tree())
    const handle = await screen.findByRole('button', { name: 'Drag to reorder Office' })
    const row = handle.closest<HTMLElement>('[data-category-row]')!
    expect(row.querySelector('button')).toBe(handle)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 180, height: 80, left: 20, right: 820, width: 800, x: 20, y: 100, toJSON: () => ({}),
    })
    const dataTransfer = { effectAllowed: '', setData: vi.fn(), setDragImage: vi.fn() }
    const start = createEvent.dragStart(handle, { dataTransfer })
    Object.defineProperties(start, { clientX: { value: 40 }, clientY: { value: 120 } })
    fireEvent(handle, start)
    const preview = document.querySelector<HTMLElement>('[data-category-drag-preview]')!
    expect(preview).toHaveTextContent('Office')
    expect(preview).toHaveTextContent('Monthly Budget')
    expect(preview).toHaveTextContent('Uncapped')
    expect(preview).toHaveStyle({ width: '800px', height: '80px', pointerEvents: 'none', opacity: '1' })
    const move = createEvent.dragOver(document)
    Object.defineProperties(move, { clientX: { value: 140 }, clientY: { value: 240 } })
    fireEvent(document, move)
    expect(preview).toHaveStyle({ left: '120px', top: '220px' })
    fireEvent.dragEnd(handle)
    expect(document.querySelector('[data-category-drag-preview]')).not.toBeInTheDocument()
    dragFrom('Office')
    view.unmount()
    expect(document.querySelector('[data-category-drag-preview]')).not.toBeInTheDocument()
  })

  it.each([
    ['Office', 'Meals', 'after', 1, 3],
    ['Meals', 'Office', 'before', 6, 1],
    ['Office', 'Meals', 'before', 1, 2],
    ['Meals', 'Office', 'after', 6, 2],
  ] as const)('moves %s %s %s to the exact sibling position', async (source, target, edge, id, level) => {
    data.push(category(6, 'Meals', 3))
    render(tree())
    await screen.findByRole('button', { name: `Drag to reorder ${source}` })
    const { dataTransfer } = dragFrom(source)
    dropOn(target, edge, dataTransfer).drop()
    await waitFor(() => expect(categoryService.updateLevel).toHaveBeenCalledExactlyOnceWith(id, level))
    await waitFor(() => expect(screen.getByRole('button', { name: `Drag to reorder ${source}` })).toBeEnabled())
    expect(data.filter((item) => item.parentCategoryId == null).find((item) => item.id === id)?.level).toBe(level)
  })

  it('drags a parent below another with a visible insertion indicator and one PATCH', async () => {
    render(tree())
    await screen.findByRole('button', { name: 'Drag to reorder Office' })
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    const { handle, dataTransfer } = dragFrom('Office')
    expect(handle).toHaveClass('cursor-grab', 'active:cursor-grabbing')
    expect(handle).toHaveAttribute('draggable', 'true')
    const { row, drop } = dropOn('Travel', 'after', dataTransfer)
    expect(row).toHaveAttribute('data-drop-edge', 'after')
    expect(dataTransfer.dropEffect).toBe('move')
    drop()
    await waitFor(() => expect(groups()[0]).toBe('Reorder Travel'))
    expect(categoryService.updateLevel).toHaveBeenCalledExactlyOnceWith(1, 2)
    expect(row).not.toHaveAttribute('data-drop-edge')
    expect(groups()).toEqual(['Reorder Travel', 'Reorder Flights', 'Reorder Office', 'Reorder Rent', 'Reorder Internet'])
  })

  it('drags a subcategory above a sibling without reparenting', async () => {
    render(tree())
    await screen.findByText('Office')
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await screen.findByRole('button', { name: 'Drag to reorder Internet' })
    const { dataTransfer } = dragFrom('Internet')
    const { row, drop } = dropOn('Rent', 'before', dataTransfer)
    expect(row).toHaveAttribute('data-drop-edge', 'before')
    drop()
    await waitFor(() => expect(groups()[1]).toBe('Reorder Internet'))
    expect(categoryService.updateLevel).toHaveBeenCalledExactlyOnceWith(4, 1)
    expect(data.find((item) => item.id === 4)?.parentCategoryId).toBe(1)
  })

  it('rejects cross-parent drops, self drops, and drops that do not change order', async () => {
    render(tree())
    await screen.findByText('Office')
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await screen.findByRole('button', { name: 'Drag to reorder Internet' })
    for (const [target, edge] of [['Flights', 'before'], ['Office', 'after'], ['Internet', 'before'], ['Rent', 'after']] as const) {
      const { handle, dataTransfer } = dragFrom('Internet')
      const { row, drop } = dropOn(target, edge, dataTransfer)
      expect(row).not.toHaveAttribute('data-drop-edge')
      drop()
      fireEvent.dragEnd(handle)
    }
    expect(categoryService.updateLevel).not.toHaveBeenCalled()
  })

  it('cancels drag outside a valid target and clears its indicator', async () => {
    render(tree())
    await screen.findByRole('button', { name: 'Drag to reorder Office' })
    const { handle, dataTransfer } = dragFrom('Office')
    const { row } = dropOn('Travel', 'after', dataTransfer)
    expect(row).toHaveAttribute('data-drop-edge', 'after')
    fireEvent.dragLeave(row)
    expect(row).not.toHaveAttribute('data-drop-edge')
    fireEvent.dragEnd(handle)
    expect(handle.closest('[data-category-row]')).not.toHaveStyle({ opacity: '0.5' })
    expect(categoryService.updateLevel).not.toHaveBeenCalled()
  })

  it('supports drag and drop in grid view', async () => {
    render(tree())
    await screen.findByRole('button', { name: 'Drag to reorder Office' })
    await userEvent.click(screen.getByTitle('Card Grid View'))
    const { dataTransfer } = dragFrom('Travel')
    dropOn('Office', 'before', dataTransfer).drop()
    await waitFor(() => expect(groups()[0]).toBe('Reorder Travel'))
    expect(categoryService.updateLevel).toHaveBeenCalledExactlyOnceWith(2, 1)
  })

  it('disables drag handles during filters and pending saves', async () => {
    let finish!: () => void
    vi.mocked(categoryService.updateLevel).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(tree())
    const handle = await screen.findByRole('button', { name: 'Drag to reorder Office' })
    const search = screen.getByPlaceholderText('Search categories by name or description...')
    await userEvent.type(search, 'Office')
    expect(handle).toBeDisabled()
    expect(handle).toHaveAttribute('draggable', 'false')
    await userEvent.clear(search)
    const { dataTransfer } = dragFrom('Office')
    dropOn('Travel', 'after', dataTransfer).drop()
    await waitFor(() => expect(handle).toBeDisabled())
    expect(handle).toHaveAttribute('draggable', 'false')
    await act(async () => finish())
    await waitFor(() => expect(handle).toBeEnabled())
  })

  it('sorts roots and children independently and handles nested response lists', () => {
    const root = { ...category(1, 'Office', 2), subCategories: [
      category(3, 'Rent', 2), category(4, 'Internet', 1),
    ] }
    const result = organizeCategories([root, category(2, 'Travel', 1), root])
    expect(result.topLevelCategories.map((item) => item.id)).toEqual([2, 1])
    expect(result.subcategoriesByParent[1].map((item) => item.id)).toEqual([4, 3])
    expect(result.allFlatCategories.map((item) => item.id)).toEqual([2, 1, 4, 3])
    expect(result.subcategoriesByParent[1][0].parentCategoryId).toBe(1)
  })

  it('uses PATCH level and accepts a response with no body', async () => {
    vi.mocked(categoryService.updateLevel).mockRestore()
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(undefined)
    await expect(categoryService.updateLevel(3, 1)).resolves.toBeUndefined()
    expect(patch).toHaveBeenCalledWith('/v1/categories/3/level', { level: 1 })
  })

  it('simplifies the heading, removes summary cards, and renders server order', async () => {
    render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Categories$/)
    expect(screen.queryByText('Test workspace')).not.toBeInTheDocument()
    for (const label of ['Total Categories', 'Monthly Allocation', 'Strict Thresholds', 'nested children']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(groups()).toEqual(['Reorder Office', 'Reorder Rent', 'Reorder Internet', 'Reorder Travel', 'Reorder Flights'])
    expect(screen.getByRole('button', { name: 'Move Office up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Travel down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Rent up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Internet down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Flights down' })).toBeDisabled()
  })

  it('moves a parent with one request and retains its children after reload', async () => {
    const view = render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await userEvent.click(screen.getByRole('button', { name: 'Move Office down' }))
    await waitFor(() => expect(groups()[0]).toBe('Reorder Travel'))
    expect(categoryService.updateLevel).toHaveBeenCalledExactlyOnceWith(1, 2)
    expect(groups()).toEqual(['Reorder Travel', 'Reorder Flights', 'Reorder Office', 'Reorder Rent', 'Reorder Internet'])
    view.unmount()
    client.clear()
    render(tree())
    await screen.findByRole('button', { name: 'Move Travel down' })
    expect(groups()[0]).toBe('Reorder Travel')
  })

  it('reorders children only within their parent using keyboard controls', async () => {
    render(tree())
    await screen.findByText('Office')
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    const button = await screen.findByRole('button', { name: 'Move Internet up' })
    button.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(groups()).toEqual([
      'Reorder Office', 'Reorder Internet', 'Reorder Rent', 'Reorder Travel', 'Reorder Flights',
    ]))
    expect(categoryService.updateLevel).toHaveBeenCalledExactlyOnceWith(4, 1)
    expect(data.find((item) => item.id === 4)?.parentCategoryId).toBe(1)
  })

  it('retains ordering controls in grid view', async () => {
    render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await userEvent.click(screen.getByTitle('Card Grid View'))
    await userEvent.click(screen.getByRole('button', { name: 'Move Rent down' }))
    await waitFor(() => expect(groups()[1]).toBe('Reorder Internet'))
    expect(categoryService.updateLevel).toHaveBeenCalledExactlyOnceWith(3, 2)
  })

  it('disables reordering with search or status filters', async () => {
    render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    const search = screen.getByPlaceholderText('Search categories by name or description...')
    await userEvent.type(search, 'Office')
    expect(screen.getByRole('button', { name: 'Move Office down' })).toBeDisabled()
    await userEvent.clear(search)
    await userEvent.click(screen.getByRole('button', { name: /^Active \(/ }))
    expect(screen.getByRole('button', { name: 'Move Office down' })).toBeDisabled()
    expect(screen.getByText('Clear search and select All to reorder categories.')).toBeInTheDocument()
    expect(categoryService.updateLevel).not.toHaveBeenCalled()
  })

  it('shows failures without pretending the category moved', async () => {
    vi.mocked(categoryService.updateLevel).mockRejectedValue(new Error('Reorder denied'))
    render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await userEvent.click(screen.getByRole('button', { name: 'Move Office down' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Reorder denied')
    expect(groups()[0]).toBe('Reorder Office')
    expect(screen.queryByText(/reordered\./)).not.toBeInTheDocument()
  })

  it('blocks concurrent moves until the server order has reloaded', async () => {
    let finish!: () => void
    vi.mocked(categoryService.updateLevel).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await userEvent.click(screen.getByRole('button', { name: 'Move Office down' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Internet up' })).toBeDisabled())
    await act(async () => finish())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move Internet up' })).toBeEnabled())
  })

  it('hides reorder controls for read-only members', async () => {
    tenant.canEdit = false
    render(tree())
    await screen.findByText('Office')
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('resets transient state and ignores previous tenant mutation feedback on switch', async () => {
    let finish!: () => void
    vi.mocked(categoryService.updateLevel).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const view = render(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await userEvent.click(screen.getByRole('button', { name: 'Move Office down' }))
    tenant.id = 2
    view.rerender(tree())
    await screen.findByRole('button', { name: 'Move Office down' })
    await act(async () => finish())
    expect(screen.queryByText(/reordered\./)).not.toBeInTheDocument()
  })

  it('preserves an existing position when editing category details', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<CategoryFormModal isOpen onClose={vi.fn()} onSubmit={submit} category={category(1, 'Office', 7)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ level: 7 })))
  })

  it('lets the backend assign a position for new categories', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<CategoryFormModal isOpen onClose={vi.fn()} onSubmit={submit} />)
    await userEvent.type(screen.getByPlaceholderText('e.g. Cloud Infrastructure, Office Supplies...'), 'New category')
    await userEvent.click(screen.getByRole('button', { name: 'Create Category' }))
    await waitFor(() => expect(submit).toHaveBeenCalledOnce())
    expect(submit.mock.calls[0][0]).not.toHaveProperty('level')
    expect(DEFAULT_CORPORATE_CATEGORIES.every((item) => item.level === undefined)).toBe(true)
  })
})
