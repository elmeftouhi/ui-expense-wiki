import React, { useState } from 'react'
import { X, Check, AlertCircle, Search } from 'lucide-react'
import type { Category, CategoryCreateRequest } from '../types'
import { AVAILABLE_CATEGORY_ICONS, CATEGORY_ICON_GROUPS } from './categoryIcons'
import { CATEGORY_COLORS } from './colorPalette'
import { Button } from '@/components/ui/button'

interface CategoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CategoryCreateRequest) => Promise<void>
  category?: Category | null
  initialParentId?: number | null
  existingCategories?: Category[]
  currencySymbol?: string
}

const CategoryFormInner: React.FC<CategoryFormModalProps> = ({
  onClose,
  onSubmit,
  category,
  initialParentId = null,
  existingCategories = [],
  currencySymbol = '$',
}) => {
  const isEditing = !!category

  const initialColor = category
    ? CATEGORY_COLORS.find(
        (c) =>
          c.textColor.toLowerCase() === category.textColor?.toLowerCase() ||
          c.backgroundColor.toLowerCase() === category.backgroundColor?.toLowerCase(),
      ) || CATEGORY_COLORS[0]
    : CATEGORY_COLORS[0]

  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [monthlyBudget, setMonthlyBudget] = useState<string>(
    category?.monthlyBudget ? String(category.monthlyBudget) : '',
  )
  const [icon, setIcon] = useState(category?.icon || 'Tag')
  const [iconQuery, setIconQuery] = useState('')
  const iconSearch = iconQuery.trim().toLocaleLowerCase()
  const visibleIconGroups = CATEGORY_ICON_GROUPS
    .map((group) => ({
      ...group,
      icons: iconSearch && !group.label.toLocaleLowerCase().includes(iconSearch)
        ? group.icons.filter((item) => `${item.label} ${item.name}`.toLocaleLowerCase().includes(iconSearch))
        : group.icons,
    }))
    .filter((group) => group.icons.length > 0)
  const selectedIconLabel = AVAILABLE_CATEGORY_ICONS.find((item) => item.name === icon)?.label ?? icon
  const [selectedColor, setSelectedColor] = useState(initialColor)
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(
    category ? (category.parentCategoryId ?? null) : initialParentId,
  )
  const [active, setActive] = useState(category ? category.active : true)
  const [allowOverBudget, setAllowOverBudget] = useState(
    category ? category.allowOverBudget : false,
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Eligible parent categories: only top-level categories, excluding current editing category
  const eligibleParents = existingCategories.filter(
    (c) => !c.parentCategoryId && (!category || c.id !== category.id),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please provide a category name.')
      return
    }

    const budgetValue = monthlyBudget.trim() ? parseFloat(monthlyBudget) : undefined
    if (budgetValue !== undefined && (isNaN(budgetValue) || budgetValue < 0)) {
      setError('Monthly budget must be a positive number.')
      return
    }

    const payload: CategoryCreateRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      textColor: selectedColor.textColor,
      backgroundColor: selectedColor.backgroundColor,
      monthlyBudget: budgetValue,
      active,
      allowOverBudget,
      parentCategoryId: parentCategoryId || null,
      ...((category?.parentCategoryId ?? null) === parentCategoryId && category?.level != null
        ? { level: category.level }
        : {}),
    }

    setIsSubmitting(true)
    try {
      await onSubmit(payload)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save category.'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-50">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isEditing ? 'Edit Category' : 'Create New Category'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEditing
                ? 'Update allocation thresholds and display metadata.'
                : 'Define departmental budget buckets and expense tagging.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Category Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">
              Category Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cloud Infrastructure, Office Supplies..."
              className="w-full h-9 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Parent Category & Level */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Parent Category (Optional)</label>
            <select
              value={parentCategoryId ? String(parentCategoryId) : ''}
              onChange={(e) =>
                setParentCategoryId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full h-9 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs"
            >
              <option value="">None (Top-Level Category)</option>
              {eligibleParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Nest this category underneath a primary departmental parent.
            </p>
          </div>

          {/* Monthly Budget */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Monthly Allocated Budget</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="5000.00"
                className="w-full h-9 pl-7 pr-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Optional spend limit. Leave empty if unmetered.
            </p>
          </div>

          {/* Icon Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="category-icon-search" className="font-semibold text-foreground">Icon Symbol</label>
              <span className="text-[11px] text-muted-foreground">{selectedIconLabel}</span>
            </div>
            <div className="rounded-xl border border-input bg-muted/20">
              <div className="flex items-center gap-2 border-b border-input/70 px-2.5 py-1.5">
                <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  id="category-icon-search"
                  type="search"
                  value={iconQuery}
                  onChange={(event) => setIconQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
                  placeholder={`Search ${AVAILABLE_CATEGORY_ICONS.length} icons…`}
                  className="h-7 w-full bg-transparent text-xs focus:outline-none"
                />
              </div>
              <div className="custom-scrollbar max-h-56 space-y-3 overflow-y-auto p-2">
                {visibleIconGroups.map((group) => (
                  <div key={group.label} role="group" aria-label={group.label} className="space-y-1">
                    <p className="px-0.5 text-[11px] font-medium text-muted-foreground">{group.label}</p>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                      {group.icons.map((item) => {
                        const isSelected = icon === item.name
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setIcon(item.name)}
                            title={item.label}
                            aria-label={item.label}
                            aria-pressed={isSelected}
                            className={`h-8 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-xs'
                                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            <item.icon className="w-4 h-4" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {visibleIconGroups.length === 0 && (
                  <p role="status" className="py-4 text-center text-xs text-muted-foreground">No icons match "{iconQuery.trim()}". Try a broader word like food or home.</p>
                )}
              </div>
            </div>
          </div>

          {/* Color Palette Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Color Palette</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => {
                const isSelected = selectedColor.label === c.label
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-primary ring-offset-1' : 'hover:opacity-85'
                    }`}
                    style={{
                      backgroundColor: c.backgroundColor,
                      color: c.textColor,
                      borderColor: isSelected ? c.textColor : 'transparent',
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.textColor }}
                    />
                    <span>{c.label}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context regarding eligible expenditures under this category..."
              className="w-full p-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Toggles: Active & Allow Over Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/30">
              <div className="space-y-0.5 pr-2">
                <span className="font-semibold text-foreground block">Active Status</span>
                <span className="text-[10px] text-muted-foreground block">
                  Available for selection in expense entries
                </span>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/30">
              <div className="space-y-0.5 pr-2">
                <span className="font-semibold text-foreground block">Allow Over Budget</span>
                <span className="text-[10px] text-muted-foreground block">
                  Permit receipts that exceed monthly threshold
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowOverBudget}
                onChange={(e) => setAllowOverBudget(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer gap-1.5 min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Category'}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = (props) => {
  if (!props.isOpen) return null

  const modalKey = props.category
    ? `edit-${props.category.id}`
    : `new-${props.initialParentId ?? 'root'}`

  return <CategoryFormInner key={modalKey} {...props} />
}
