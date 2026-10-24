import React, { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  FolderTree,
  LayoutGrid,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Power,
  ShieldCheck,
  ShieldOff,
  CornerDownRight,
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
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
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
  const { activeTenant, currentRole, canEdit } = useActiveTenant()
  const toast = useToast()

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

  // Flatten and organize hierarchical structure
  // Note: Backend might return flat list or list with subCategories
  const { topLevelCategories, subcategoriesByParent, allFlatCategories } = useMemo(() => {
    return organizeCategories(rawCategories)
  }, [rawCategories])

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return allFlatCategories.filter((cat) => {
      // Search filter
      const matchesSearch =
        !search.trim() ||
        cat.name.toLowerCase().includes(search.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(search.toLowerCase()))

      // Status filter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && cat.active) ||
        (statusFilter === 'INACTIVE' && !cat.active)

      return matchesSearch && matchesStatus
    })
  }, [allFlatCategories, search, statusFilter])

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCount = allFlatCategories.length
    const activeCount = allFlatCategories.filter((c) => c.active).length
    const inactiveCount = totalCount - activeCount
    return {
      totalCount,
      activeCount,
      inactiveCount,
    }
  }, [allFlatCategories])

  const isFiltered = Boolean(search.trim()) || statusFilter !== 'ALL'
  const reorderDisabled = isFiltered || isLoading || isError || reorderMutation.isPending
    || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
    || toggleStatusMutation.isPending || isSeeding
  const handleMove = (category: Category, level: number) => {
    if (!canEdit || reorderDisabled) return
    reorderMutation.mutate({ id: category.id, level }, {
      onSuccess: () => toast.success(`Category "${category.name}" reordered.`),
    })
  }
  const siblingsFor = (category: Category) => category.parentCategoryId != null
    ? subcategoriesByParent[category.parentCategoryId] ?? []
    : topLevelCategories
  const dragReorder = useCategoryDragReorder({
    disabled: !canEdit || reorderDisabled,
    siblingsFor,
    onMove: handleMove,
  })
  const reorderControls = (category: Category) => canEdit && (
    <CategoryReorderControls
      category={category}
      siblings={siblingsFor(category)}
      disabled={reorderDisabled}
      onMove={handleMove}
    />
  )
  const dragHandle = (category: Category) => canEdit && (
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

  // Handlers
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
      toast.success(`Category "${payload.name}" updated successfully.`)
    } else {
      await createMutation.mutateAsync(payload)
      toast.success(`Category "${payload.name}" created successfully.`)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deletingCategory) {
      await deleteMutation.mutateAsync(deletingCategory.id)
      toast.success(`Category "${deletingCategory.name}" removed.`)
    }
  }

  const handleToggleStatus = async (category: Category) => {
    try {
      await toggleStatusMutation.mutateAsync(category.id)
      toast.success(
        `Category "${category.name}" is now ${category.active ? 'inactive' : 'active'}.`,
      )
    } catch (error) {
      toast.error(`Failed to switch status for "${category.name}".`, getApiErrorMessage(error))
    }
  }

  const handleSeedDefaults = async () => {
    setIsSeeding(true)
    try {
      for (const item of DEFAULT_CORPORATE_CATEGORIES) {
        await createMutation.mutateAsync(item)
      }
      toast.success('Standard corporate categories initialized successfully.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to seed categories.'
      toast.error('Error seeding categories', msg)
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Categories</h1>

        <div className="flex items-center gap-2.5">
          {canEdit ? (
            <>
              {allFlatCategories.length === 0 && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleSeedDefaults}
                  disabled={isSeeding}
                  className="flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{isSeeding ? 'Seeding...' : 'Quick Seed Defaults'}</span>
                </Button>
              )}

              <Button
                size="default"
                onClick={handleOpenCreateRoot}
                className="flex items-center gap-2 cursor-pointer text-xs shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 p-1.5 px-3 rounded-lg bg-muted text-muted-foreground text-xs border border-border">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Read-Only ({currentRole})</span>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/50">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories by name or description..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'TREE' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                disabled={isLoading || isError || !topLevelCategories.some((parent) => subcategoriesByParent[parent.id]?.length)}
                className="text-xs cursor-pointer"
              >
                Expand all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedParents({})}
                disabled={!Object.values(expandedParents).some(Boolean)}
                className="text-xs cursor-pointer"
              >
                Collapse all
              </Button>
            </>
          )}
          {/* Status Tabs */}
          <div className="flex items-center p-0.5 rounded-lg border border-input bg-muted/30 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({metrics.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active ({metrics.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inactive ({metrics.inactiveCount})
            </button>
          </div>

          {/* View Mode Toggle: Tree vs Grid */}
          <div className="flex items-center p-0.5 rounded-lg border border-input bg-muted/30 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('TREE')}
              title="Hierarchical Tree View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'TREE'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FolderTree className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              title="Card Grid View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Categories Display */}
      {canEdit && isFiltered && <p className="text-xs text-muted-foreground">Clear search and select All to reorder categories.</p>}
      {reorderMutation.error && (
        <p role="alert" className="text-sm text-destructive">
          Could not reorder category: {getApiErrorMessage(reorderMutation.error)}
        </p>
      )}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Loading organization categories...</p>
        </div>
      ) : isError ? (
        <Card className="p-8 text-center space-y-3 border-destructive/20 bg-destructive/5">
          <p className="text-xs text-destructive font-medium">
            Failed to load categories: {error?.message || 'Server error'}
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="cursor-pointer">
            Retry Connection
          </Button>
        </Card>
      ) : allFlatCategories.length === 0 ? (
        /* Empty State */
        <Card className="p-12 text-center space-y-4 border-dashed">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FolderTree className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">No Categories Found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Categories allow you to tag expenses, allocate department-level monthly budgets,
              and enforce spending guardrails.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>{isSeeding ? 'Creating standard categories...' : 'Seed Default Categories'}</span>
              </Button>
              <Button size="sm" onClick={handleOpenCreateRoot} className="gap-1.5 text-xs cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>Create Custom Category</span>
              </Button>
            </div>
          )}
        </Card>
      ) : filteredCategories.length === 0 ? (
        /* No Search Match State */
        <Card className="p-8 text-center space-y-2 border-dashed">
          <p className="text-xs text-muted-foreground">
            No categories match the filter &quot;{search}&quot;.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setStatusFilter('ALL')
            }}
            className="text-xs cursor-pointer"
          >
            Clear Filters
          </Button>
        </Card>
      ) : viewMode === 'TREE' ? (
        /* Hierarchical Tree View */
        <div className="space-y-3">
          {topLevelCategories
            .filter((parent) => {
              // Show parent if parent matches or any child matches
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
              const isExpanded = expandedParents[parent.id] ?? false

              return (
                <div
                  key={parent.id}
                  className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs hover:border-border transition-all"
                >
                  {/* Parent Category Row */}
                  <div {...dragReorder.rowProps(parent)} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {dragHandle(parent)}
                      {/* Expand / Collapse for children */}
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(parent.id)}
                          className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer shrink-0"
                          title={isExpanded ? 'Collapse subcategories' : 'Expand subcategories'}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${parent.name} subcategories`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <div className="w-6 shrink-0" />
                      )}

                      {/* Icon & Color Badge */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: parent.backgroundColor || '#EFF6FF',
                          color: parent.textColor || '#2563EB',
                          borderColor: parent.textColor ? `${parent.textColor}33` : '#DBEAFE',
                        }}
                      >
                        <CategoryIcon name={parent.icon} className="w-4 h-4" />
                      </div>

                      {/* Name & Details */}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-foreground">
                            {parent.name}
                          </span>
                          {/* Active / Inactive status pill */}
                          <Badge
                            variant={parent.active ? 'default' : 'secondary'}
                            className={`text-[10px] px-1.5 py-0 h-4.5 font-normal ${
                              parent.active
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                parent.active ? 'bg-emerald-500' : 'bg-muted-foreground'
                              }`}
                            />
                            {parent.active ? 'Active' : 'Inactive'}
                          </Badge>

                          {/* Budget Policy Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4.5 ${
                              parent.allowOverBudget
                                ? 'text-amber-600 border-amber-500/30'
                                : 'text-blue-600 border-blue-500/30'
                            }`}
                          >
                            {parent.allowOverBudget ? (
                              <span className="flex items-center gap-1">
                                <ShieldOff className="w-2.5 h-2.5" /> Flexible
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="w-2.5 h-2.5" /> Strict Limit
                              </span>
                            )}
                          </Badge>

                          {hasChildren && (
                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                              {children.length} subcategories
                            </span>
                          )}
                        </div>

                        {parent.description && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-xl">
                            {parent.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right side: Budget & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-9 sm:pl-0">
                      {/* Budget */}
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">
                          Monthly Budget
                        </span>
                        <span className="font-semibold text-xs text-foreground font-mono">
                          {parent.monthlyBudget
                            ? formatCurrency(parent.monthlyBudget, {
                                currency: activeTenant.currency,
                                locale: activeTenant.locale,
                              })
                            : 'Uncapped'}
                        </span>
                      </div>

                      {/* Action buttons */}
                      {canEdit && (
                        <div className="flex items-center gap-1 border-l border-border/60 pl-2">
                          {reorderControls(parent)}
                          <button
                            type="button"
                            onClick={() => handleOpenCreateSub(parent.id)}
                            title="Add nested subcategory"
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(parent)}
                            title={parent.active ? 'Deactivate category' : 'Activate category'}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(parent)}
                            title="Edit category"
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(parent)}
                            title="Delete category"
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subcategories (if expanded) */}
                  {hasChildren && isExpanded && (
                    <div className="border-t border-border/50 bg-muted/15 pl-6 sm:pl-10 divide-y divide-border/40">
                      {children.map((sub) => (
                        <div
                          key={sub.id}
                          {...dragReorder.rowProps(sub)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2.5 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {dragHandle(sub)}
                            <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                              style={{
                                backgroundColor: sub.backgroundColor || '#F1F5F9',
                                color: sub.textColor || '#475569',
                                borderColor: sub.textColor ? `${sub.textColor}33` : '#E2E8F0',
                              }}
                            >
                              <CategoryIcon name={sub.icon} className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-xs text-foreground">
                                  {sub.name}
                                </span>
                                <Badge
                                  variant={sub.active ? 'default' : 'secondary'}
                                  className={`text-[9px] px-1 py-0 h-4 font-normal ${
                                    sub.active
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {sub.active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              {sub.description && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-md">
                                  {sub.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-6 sm:pl-0">
                            <span className="font-mono text-xs text-muted-foreground">
                              {sub.monthlyBudget
                                ? formatCurrency(sub.monthlyBudget, {
                                    currency: activeTenant.currency,
                                    locale: activeTenant.locale,
                                  })
                                : '—'}
                            </span>
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                {reorderControls(sub)}
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(sub)}
                                  title={sub.active ? 'Deactivate' : 'Activate'}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                >
                                  <Power className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(sub)}
                                  title="Edit subcategory"
                                  className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(sub)}
                                  title="Delete subcategory"
                                  className="p-1 rounded text-muted-foreground hover:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const parentCat = cat.parentCategoryId
              ? allFlatCategories.find((p) => p.id === cat.parentCategoryId)
              : null

            return (
              <Card
                key={cat.id}
                {...dragReorder.rowProps(cat)}
                className="hover:border-border transition-all flex flex-col justify-between"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Top Bar: Icon, Name, and Parent Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {dragHandle(cat)}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: cat.backgroundColor || '#EFF6FF',
                          color: cat.textColor || '#2563EB',
                          borderColor: cat.textColor ? `${cat.textColor}33` : '#DBEAFE',
                        }}
                      >
                        <CategoryIcon name={cat.icon} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs text-foreground truncate">
                          {cat.name}
                        </h4>
                        {parentCat && (
                          <span className="text-[10px] text-muted-foreground block truncate">
                            Subcategory of {parentCat.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={cat.active ? 'default' : 'secondary'}
                      className={`text-[10px] px-1.5 py-0 h-4.5 font-normal shrink-0 ${
                        cat.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {cat.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Description */}
                  {cat.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {cat.description}
                    </p>
                  )}

                  {/* Budget & Policy */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Monthly Budget
                      </span>
                      <span className="font-semibold text-xs text-foreground font-mono">
                        {cat.monthlyBudget
                          ? formatCurrency(cat.monthlyBudget, {
                              currency: activeTenant.currency,
                              locale: activeTenant.locale,
                            })
                          : 'Uncapped'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">Policy</span>
                      <span
                        className={`text-[10px] font-medium ${
                          cat.allowOverBudget ? 'text-amber-600' : 'text-blue-600'
                        }`}
                      >
                        {cat.allowOverBudget ? 'Flexible' : 'Strict Limit'}
                      </span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  {canEdit && (
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cat)}
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                      >
                        <Power className="w-3 h-3" />
                        <span>{cat.active ? 'Deactivate' : 'Activate'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {reorderControls(cat)}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(cat)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Category Create & Edit Modal */}
      <CategoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        category={editingCategory}
        initialParentId={selectedParentId}
        existingCategories={topLevelCategories}
        currencySymbol={activeTenant.currency === 'EUR' ? '€' : '$'}
      />

      {/* Category Delete Confirmation Modal */}
      <CategoryDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        category={deletingCategory}
        hasSubcategories={
          !!deletingCategory && (subcategoriesByParent[deletingCategory.id]?.length || 0) > 0
        }
      />
    </div>
  )
}
