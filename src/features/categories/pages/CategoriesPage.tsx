import React, { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  FolderTree,
  LayoutGrid,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Power,
  CornerDownRight,
  AlertCircle,
  X,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useToggleCategoryStatus,
  useReorderCategory,
} from '../hooks/useCategories'
import type { Category, CategoryCreateRequest } from '../types'
import { CategoryIcon } from '../components/CategoryIcon'
import { CategoryFormModal } from '../components/CategoryFormModal'
import { CategoryDeleteModal } from '../components/CategoryDeleteModal'
import { DEFAULT_CORPORATE_CATEGORIES } from '../data/defaultCategories'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getApiErrorMessage } from '@/lib/api-error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { ExpenseRowMenu, type RowMenuItem } from '@/features/expenses/components/ExpenseRowMenu'
import { CategoryReorderControls } from '../components/CategoryReorderControls'
import { organizeCategories } from '../utils/categoryOrder'
import { useCategoryDragReorder } from '../hooks/useCategoryDragReorder'
import { CategoryDragHandle } from '../components/CategoryDragHandle'
import { useToast } from '@/components/ui/use-toast'

export const CategoriesPage: React.FC = () => {
  const { activeTenant } = useActiveTenant()
  return <TenantCategoriesPage key={activeTenant.id} />
}

const TenantCategoriesPage: React.FC = () => {
  const { canEdit } = useActiveTenant()
  const toast = useToast()
  const isDesktop = useMediaQuery('(min-width: 768px)', true)

  // Queries & Mutations
  const { data: rawCategories = [], isLoading, isError, error, refetch } = useCategories(true)
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()
  const toggleStatusMutation = useToggleCategoryStatus()
  const reorderMutation = useReorderCategory()

  // Local UI State
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [viewMode, setViewMode] = useState<'TREE' | 'GRID'>('TREE')
  const [expandedParents, setExpandedParents] = useState<Record<number, boolean>>({})

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  const [isSeeding, setIsSeeding] = useState(false)

  // Organize hierarchical structure sorted by server level
  const { topLevelCategories, subcategoriesByParent, allFlatCategories } = useMemo(() => {
    return organizeCategories(rawCategories)
  }, [rawCategories])

  // Filtered categories
  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allFlatCategories.filter((cat) => {
      const matchesSearch =
        !query ||
        cat.name.toLowerCase().includes(query) ||
        Boolean(cat.description && cat.description.toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && cat.active) ||
        (statusFilter === 'INACTIVE' && !cat.active)

      return matchesSearch && matchesStatus
    })
  }, [allFlatCategories, search, statusFilter])

  // Counts for status filter pills
  const metrics = useMemo(() => {
    const totalCount = allFlatCategories.length
    const activeCount = allFlatCategories.filter((c) => c.active).length
    return {
      totalCount,
      activeCount,
      inactiveCount: totalCount - activeCount,
    }
  }, [allFlatCategories])

  const isFiltered = Boolean(search.trim()) || statusFilter !== 'ALL'
  const reorderDisabled =
    isFiltered ||
    isLoading ||
    isError ||
    reorderMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    toggleStatusMutation.isPending ||
    isSeeding

  const handleMove = (category: Category, level: number) => {
    if (!canEdit || reorderDisabled) return
    reorderMutation.mutate(
      { id: category.id, level },
      {
        onSuccess: () => toast.success(`Category "${category.name}" reordered.`),
      },
    )
  }

  const siblingsFor = (category: Category) =>
    category.parentCategoryId != null
      ? (subcategoriesByParent[category.parentCategoryId] ?? [])
      : topLevelCategories

  const dragReorder = useCategoryDragReorder({
    disabled: !canEdit || reorderDisabled,
    siblingsFor,
    onMove: handleMove,
  })

  const reorderControls = (category: Category) =>
    canEdit && (
      <CategoryReorderControls
        category={category}
        siblings={siblingsFor(category)}
        disabled={reorderDisabled}
        onMove={handleMove}
      />
    )

  const dragHandle = (category: Category) =>
    canEdit && (
      <CategoryDragHandle
        name={category.name}
        disabled={reorderDisabled || siblingsFor(category).length < 2}
        {...dragReorder.handleProps(category)}
      />
    )

  const toggleExpand = (parentId: number) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }))
  }

  const expandAll = () => {
    setExpandedParents(Object.fromEntries(topLevelCategories.map((parent) => [parent.id, true])))
  }

  // Modal & Mutation Handlers
  const handleOpenCreateRoot = () => {
    setEditingCategory(null)
    setSelectedParentId(null)
    setIsFormModalOpen(true)
  }

  const handleOpenCreateSub = (parentId: number) => {
    setEditingCategory(null)
    setSelectedParentId(parentId)
    setIsFormModalOpen(true)
  }

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category)
    setSelectedParentId(category.parentCategoryId ?? null)
    setIsFormModalOpen(true)
  }

  const handleOpenDelete = (category: Category) => {
    setDeletingCategory(category)
    setIsDeleteModalOpen(true)
  }

  const handleFormSubmit = async (payload: CategoryCreateRequest) => {
    if (editingCategory) {
      await updateMutation.mutateAsync({ id: editingCategory.id, payload })
      toast.success(`Category "${payload.name}" updated.`)
    } else {
      await createMutation.mutateAsync(payload)
      toast.success(`Category "${payload.name}" created.`)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deletingCategory) {
      await deleteMutation.mutateAsync(deletingCategory.id)
      toast.success(`Category "${deletingCategory.name}" deleted.`)
    }
  }

  const handleToggleStatus = async (category: Category) => {
    try {
      await toggleStatusMutation.mutateAsync(category.id)
      toast.success(
        `Category "${category.name}" is now ${category.active ? 'inactive' : 'active'}.`,
      )
    } catch (err) {
      toast.error(`Failed to switch status for "${category.name}".`, getApiErrorMessage(err))
    }
  }

  const handleSeedDefaults = async () => {
    setIsSeeding(true)
    try {
      for (const item of DEFAULT_CORPORATE_CATEGORIES) {
        await createMutation.mutateAsync(item)
      }
      toast.success('Starter categories created.')
    } catch (err) {
      toast.error('Could not create starter categories', getApiErrorMessage(err))
    } finally {
      setIsSeeding(false)
    }
  }

  const buildMenuItems = (category: Category, allowAddSub: boolean): RowMenuItem[] => [
    ...(allowAddSub
      ? [
          {
            key: 'add-sub',
            label: 'Add subcategory',
            icon: <Plus className="h-4 w-4 text-muted-foreground" />,
            onSelect: () => handleOpenCreateSub(category.id),
          },
        ]
      : []),
    {
      key: 'edit',
      label: 'Edit',
      icon: <Edit2 className="h-4 w-4 text-muted-foreground" />,
      onSelect: () => handleOpenEdit(category),
    },
    {
      key: 'toggle',
      label: category.active ? 'Deactivate' : 'Activate',
      icon: <Power className="h-4 w-4 text-muted-foreground" />,
      onSelect: () => void handleToggleStatus(category),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      destructive: true,
      onSelect: () => handleOpenDelete(category),
    },
  ]

  const renderDesktopActions = (category: Category, allowAddSub: boolean) => (
    <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5">
      {allowAddSub && (
        <button
          type="button"
          onClick={() => handleOpenCreateSub(category.id)}
          title="Add subcategory"
          aria-label={`Add subcategory to ${category.name}`}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => void handleToggleStatus(category)}
        title={category.active ? 'Deactivate' : 'Activate'}
        aria-label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Power className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleOpenEdit(category)}
        title="Edit"
        aria-label={`Edit ${category.name}`}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleOpenDelete(category)}
        title="Delete"
        aria-label={`Delete ${category.name}`}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  const renderRowActions = (category: Category, allowAddSub: boolean) => {
    if (!canEdit) return null
    return (
      <div className="flex shrink-0 items-center gap-1">
        {reorderControls(category)}
        {isDesktop ? (
          renderDesktopActions(category, allowAddSub)
        ) : (
          <ExpenseRowMenu
            label={`Actions for ${category.name}`}
            title={category.name}
            items={buildMenuItems(category, allowAddSub)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Compact Single-Row Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Categories
        </h1>

        {canEdit ? (
          <Button
            size="sm"
            onClick={handleOpenCreateRoot}
            className="h-8 shrink-0 cursor-pointer gap-1.5 px-3 text-xs sm:h-9 sm:px-3.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Category</span>
          </Button>
        ) : (
          <Badge variant="secondary" className="shrink-0 font-normal text-muted-foreground">
            View only
          </Badge>
        )}
      </div>

      {/* Filter & View Toolbar */}
      {(allFlatCategories.length > 0 || isFiltered) && (
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 lg:max-w-sm">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories by name or description..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-8 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Status Filter + Tree Controls + View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            {/* Status Segmented Control */}
            <div className="inline-flex h-9 items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs">
              {([
                { key: 'ALL', label: 'All', count: metrics.totalCount },
                { key: 'ACTIVE', label: 'Active', count: metrics.activeCount },
                { key: 'INACTIVE', label: 'Inactive', count: metrics.inactiveCount },
              ] as const).map((tab) => {
                const isActive = statusFilter === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      'cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      isActive
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label} (<span className="font-mono tabular-nums">{tab.count}</span>)
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-1.5">
              {viewMode === 'TREE' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAll}
                    disabled={
                      isLoading ||
                      isError ||
                      isFiltered ||
                      !topLevelCategories.some((parent) => subcategoriesByParent[parent.id]?.length)
                    }
                    className="h-8 cursor-pointer px-2.5 text-xs"
                  >
                    Expand all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedParents({})}
                    disabled={isFiltered || !Object.values(expandedParents).some(Boolean)}
                    className="h-8 cursor-pointer px-2.5 text-xs"
                  >
                    Collapse all
                  </Button>
                </>
              )}

              {/* View Mode Switcher */}
              <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('TREE')}
                  title="Hierarchical Tree View"
                  aria-label="Hierarchical Tree View"
                  aria-pressed={viewMode === 'TREE'}
                  className={cn(
                    'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                    viewMode === 'TREE'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <FolderTree className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('GRID')}
                  title="Card Grid View"
                  aria-label="Card Grid View"
                  aria-pressed={viewMode === 'GRID'}
                  className={cn(
                    'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                    viewMode === 'GRID'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Filter Hint & Error */}
      {canEdit && isFiltered && allFlatCategories.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Clear search and select All to reorder categories.
        </p>
      )}
      {reorderMutation.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Could not reorder category: {getApiErrorMessage(reorderMutation.error)}</span>
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="rounded-xl border border-border/80 bg-card p-12 text-center shadow-xs">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-xs text-muted-foreground">Loading categories…</p>
        </div>
      ) : isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/25 bg-destructive/5 p-8 text-center">
          <p className="text-xs font-medium text-destructive">
            Failed to load categories: {error?.message || 'Server error'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="cursor-pointer text-xs"
          >
            Retry
          </Button>
        </div>
      ) : allFlatCategories.length === 0 ? (
        /* Empty State */
        <div className="space-y-4 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center sm:p-12">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderTree className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">No categories yet</h2>
            <p className="mx-auto max-w-sm text-xs text-muted-foreground">
              Create your first category or load starter categories to organize expenses and budgets.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSeedDefaults()}
                disabled={isSeeding}
                className="cursor-pointer gap-1.5 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>{isSeeding ? 'Loading…' : 'Load starter categories'}</span>
              </Button>
              <Button
                size="sm"
                onClick={handleOpenCreateRoot}
                className="cursor-pointer gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Category</span>
              </Button>
            </div>
          )}
        </div>
      ) : filteredCategories.length === 0 ? (
        /* No Filter Match State */
        <div className="space-y-2.5 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <p className="text-xs text-muted-foreground">
            {search.trim()
              ? `No categories match "${search.trim()}".`
              : `No ${statusFilter.toLowerCase()} categories found.`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('')
              setStatusFilter('ALL')
            }}
            className="h-8 cursor-pointer text-xs"
          >
            Clear filters
          </Button>
        </div>
      ) : viewMode === 'TREE' ? (
        /* Unified Hierarchical Tree Ledger */
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs">
          {topLevelCategories
            .filter((parent) => {
              const matchesSelf = filteredCategories.some((c) => c.id === parent.id)
              const children = subcategoriesByParent[parent.id] || []
              const matchesChild = children.some((ch) =>
                filteredCategories.some((c) => c.id === ch.id),
              )
              return matchesSelf || matchesChild
            })
            .map((parent) => {
              const children = (subcategoriesByParent[parent.id] || []).filter((child) =>
                filteredCategories.some((c) => c.id === child.id),
              )
              const hasChildren = children.length > 0
              const isExpanded =
                (isFiltered && hasChildren) || (expandedParents[parent.id] ?? false)

              return (
                <div key={parent.id}>
                  {/* Parent Category Row */}
                  <div
                    {...dragReorder.rowProps(parent)}
                    className={cn(
                      'group/row flex items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-muted/25 sm:px-4 sm:py-3',
                      !parent.active && 'bg-muted/15',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
                      {dragHandle(parent)}

                      {/* Expand / Collapse Chevron */}
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(parent.id)}
                          disabled={isFiltered}
                          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-60"
                          title={isExpanded ? 'Collapse subcategories' : 'Expand subcategories'}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${parent.name} subcategories`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        <div className="w-7 shrink-0" aria-hidden="true" />
                      )}

                      {/* Icon Swatch */}
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                          !parent.active && 'opacity-65',
                        )}
                        style={{
                          backgroundColor: parent.backgroundColor || '#EFF6FF',
                          color: parent.textColor || '#2563EB',
                          borderColor: parent.textColor ? `${parent.textColor}33` : '#DBEAFE',
                        }}
                      >
                        <CategoryIcon name={parent.icon} className="h-4 w-4" />
                      </div>

                      {/* Name, Subcategory Count & Description */}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              'truncate text-xs font-semibold sm:text-[13px]',
                              parent.active ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {parent.name}
                          </span>

                          {!parent.active && (
                            <Badge
                              variant="secondary"
                              className="h-4 shrink-0 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                            >
                              Inactive
                            </Badge>
                          )}

                          {hasChildren && (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                              {children.length}
                              <span className="hidden sm:inline">
                                {' '}
                                {children.length === 1 ? 'subcategory' : 'subcategories'}
                              </span>
                            </span>
                          )}
                        </div>

                        {parent.description && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {parent.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {renderRowActions(parent, true)}
                  </div>

                  {/* Nested Subcategories */}
                  {hasChildren && isExpanded && (
                    <div className="divide-y divide-border/40 border-t border-border/50 bg-muted/15">
                      {children.map((sub) => (
                        <div
                          key={sub.id}
                          {...dragReorder.rowProps(sub)}
                          className={cn(
                            'group/row flex items-center justify-between gap-2 py-2 pr-3 pl-6 transition-colors hover:bg-muted/30 sm:py-2.5 sm:pr-4 sm:pl-11',
                            !sub.active && 'bg-muted/20',
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {dragHandle(sub)}
                            <CornerDownRight
                              aria-hidden="true"
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                            />
                            <div
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                                !sub.active && 'opacity-65',
                              )}
                              style={{
                                backgroundColor: sub.backgroundColor || '#F1F5F9',
                                color: sub.textColor || '#475569',
                                borderColor: sub.textColor ? `${sub.textColor}33` : '#E2E8F0',
                              }}
                            >
                              <CategoryIcon name={sub.icon} className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className={cn(
                                    'truncate text-xs font-medium',
                                    sub.active ? 'text-foreground' : 'text-muted-foreground',
                                  )}
                                >
                                  {sub.name}
                                </span>
                                {!sub.active && (
                                  <Badge
                                    variant="secondary"
                                    className="h-4 shrink-0 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                                  >
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              {sub.description && (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {sub.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {renderRowActions(sub, false)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      ) : (
        /* Clean Card Grid View */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((cat) => {
            const parentCat = cat.parentCategoryId
              ? allFlatCategories.find((p) => p.id === cat.parentCategoryId)
              : null
            const childCount = !cat.parentCategoryId
              ? (subcategoriesByParent[cat.id]?.length ?? 0)
              : 0

            return (
              <div
                key={cat.id}
                {...dragReorder.rowProps(cat)}
                className={cn(
                  'flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 text-card-foreground shadow-xs transition-colors hover:border-border',
                  !cat.active && 'bg-muted/15',
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {dragHandle(cat)}
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                          !cat.active && 'opacity-65',
                        )}
                        style={{
                          backgroundColor: cat.backgroundColor || '#EFF6FF',
                          color: cat.textColor || '#2563EB',
                          borderColor: cat.textColor ? `${cat.textColor}33` : '#DBEAFE',
                        }}
                      >
                        <CategoryIcon name={cat.icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3
                          className={cn(
                            'truncate text-xs font-semibold',
                            cat.active ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {cat.name}
                        </h3>
                        {parentCat ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            in {parentCat.name}
                          </span>
                        ) : childCount > 0 ? (
                          <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">
                            {childCount} {childCount === 1 ? 'subcategory' : 'subcategories'}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {!cat.active && (
                      <Badge
                        variant="secondary"
                        className="h-4.5 shrink-0 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                      >
                        Inactive
                      </Badge>
                    )}
                  </div>

                  {cat.description && (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {cat.description}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                    {reorderControls(cat)}
                    {isDesktop ? (
                      renderDesktopActions(cat, !cat.parentCategoryId)
                    ) : (
                      <ExpenseRowMenu
                        label={`Actions for ${cat.name}`}
                        title={cat.name}
                        items={buildMenuItems(cat, !cat.parentCategoryId)}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create & Edit Modal */}
      <CategoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        category={editingCategory}
        initialParentId={selectedParentId}
        existingCategories={topLevelCategories}
      />

      {/* Delete Confirmation Modal */}
      <CategoryDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        category={deletingCategory}
        hasSubcategories={
          Boolean(deletingCategory) &&
          (subcategoriesByParent[deletingCategory!.id]?.length || 0) > 0
        }
      />
    </div>
  )
}
