import React, { useState } from 'react'
import { Check, AlertCircle, Loader2, Pipette, Search, X } from 'lucide-react'
import type { Category, CategoryCreateRequest } from '../types'
import { AVAILABLE_CATEGORY_ICONS, CATEGORY_ICON_GROUPS } from './categoryIcons'
import { CategoryIcon } from './CategoryIcon'
import {
  CATEGORY_COLORS,
  deriveCategoryColorPair,
  normalizeHexColor,
  resolveCategoryColor,
} from './colorPalette'
import { CategoryDialog } from './CategoryDialog'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

export interface CategoryFormModalProps {
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
}) => {
  const isEditing = Boolean(category)

  const initialColor = category
    ? resolveCategoryColor(category.textColor, category.backgroundColor)
    : CATEGORY_COLORS[0]

  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [icon, setIcon] = useState(category?.icon || 'Tag')
  const [iconQuery, setIconQuery] = useState('')
  const [selectedColor, setSelectedColor] = useState(initialColor)
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(Boolean(initialColor.isCustom))
  const [customHexInput, setCustomHexInput] = useState(
    initialColor.isCustom ? initialColor.textColor : '#6366F1',
  )
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(
    category ? (category.parentCategoryId ?? null) : initialParentId,
  )
  const [active, setActive] = useState(category ? category.active : true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const iconSearch = iconQuery.trim().toLocaleLowerCase()
  const visibleIconGroups = CATEGORY_ICON_GROUPS.map((group) => ({
    ...group,
    icons:
      iconSearch && !group.label.toLocaleLowerCase().includes(iconSearch)
        ? group.icons.filter((item) =>
            `${item.label} ${item.name}`.toLocaleLowerCase().includes(iconSearch),
          )
        : group.icons,
  })).filter((group) => group.icons.length > 0)

  const selectedIconLabel =
    AVAILABLE_CATEGORY_ICONS.find((item) => item.name === icon)?.label ?? icon

  // Eligible parent categories: only top-level categories, excluding the category being edited
  const eligibleParents = existingCategories.filter(
    (c) => !c.parentCategoryId && (!category || c.id !== category.id),
  )

  const showParentSelector = eligibleParents.length > 0 || parentCategoryId !== null

  const applyCustomHex = (rawValue: string) => {
    setCustomHexInput(rawValue)
    const normalized = normalizeHexColor(rawValue)
    if (normalized) {
      setSelectedColor(deriveCategoryColorPair(normalized))
    }
  }

  const handleOpenCustomPicker = () => {
    setIsCustomPickerOpen(true)
    const seedHex = normalizeHexColor(customHexInput) ?? selectedColor.textColor
    setCustomHexInput(seedHex)
    if (!selectedColor.isCustom) {
      setSelectedColor(deriveCategoryColorPair(seedHex))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please provide a category name.')
      return
    }

    const payload: CategoryCreateRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      textColor: selectedColor.textColor,
      backgroundColor: selectedColor.backgroundColor,
      monthlyBudget: category?.monthlyBudget,
      active,
      allowOverBudget: category ? category.allowOverBudget : false,
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
      setError(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const dialogTitle = isEditing
    ? 'Edit category'
    : parentCategoryId
      ? 'New subcategory'
      : 'New category'

  const pickerSwatchValue = normalizeHexColor(customHexInput) ?? selectedColor.textColor

  return (
    <CategoryDialog title={dialogTitle} onClose={onClose} dismissible={!isSubmitting}>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Live Preview Swatch + Name */}
        <div className="space-y-1.5">
          <label htmlFor="category-name" className="font-semibold text-foreground">
            Name <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
              style={{
                backgroundColor: selectedColor.backgroundColor,
                color: selectedColor.textColor,
                borderColor: `${selectedColor.textColor}33`,
              }}
            >
              <CategoryIcon name={icon} className="h-4 w-4" />
            </div>
            <input
              id="category-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cloud Infrastructure, Office Supplies..."
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Parent Category */}
        {showParentSelector && (
          <div className="space-y-1.5">
            <label htmlFor="category-parent" className="font-semibold text-foreground">
              Parent category
            </label>
            <select
              id="category-parent"
              value={parentCategoryId ? String(parentCategoryId) : ''}
              onChange={(e) =>
                setParentCategoryId(e.target.value ? Number(e.target.value) : null)
              }
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">None (top-level)</option>
              {eligibleParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Color Swatches + Custom Color Picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">Color</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {selectedColor.isCustom ? selectedColor.textColor : selectedColor.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Color">
            {CATEGORY_COLORS.map((c) => {
              const isSelected = !selectedColor.isCustom && selectedColor.label === c.label
              return (
                <button
                  key={c.label}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => {
                    setSelectedColor(c)
                    setIsCustomPickerOpen(false)
                  }}
                  className={cn(
                    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                      : 'hover:scale-105',
                  )}
                  style={{
                    backgroundColor: c.backgroundColor,
                    color: c.textColor,
                    borderColor: `${c.textColor}55`,
                  }}
                >
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.textColor }}
                    />
                  )}
                </button>
              )
            })}

            {/* Custom Color Trigger */}
            <button
              type="button"
              role="radio"
              aria-checked={Boolean(selectedColor.isCustom)}
              aria-label="Custom color"
              title="Custom color"
              onClick={handleOpenCustomPicker}
              className={cn(
                'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selectedColor.isCustom
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                  : 'border-dashed border-muted-foreground/50 bg-muted/30 text-muted-foreground hover:border-foreground hover:text-foreground',
              )}
              style={
                selectedColor.isCustom
                  ? {
                      backgroundColor: selectedColor.backgroundColor,
                      color: selectedColor.textColor,
                      borderColor: `${selectedColor.textColor}55`,
                    }
                  : undefined
              }
            >
              <Pipette className="h-3.5 w-3.5" />
            </button>
          </div>

          {isCustomPickerOpen && (
            <div className="flex items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick custom color"
                  value={pickerSwatchValue}
                  onChange={(e) => applyCustomHex(e.target.value)}
                  className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <input
                  type="text"
                  aria-label="Custom hex color"
                  value={customHexInput}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(e) => applyCustomHex(e.target.value)}
                  onBlur={() => {
                    const valid = normalizeHexColor(customHexInput)
                    if (!valid) setCustomHexInput(selectedColor.textColor)
                    else setCustomHexInput(valid)
                  }}
                  placeholder="#6366F1"
                  className="h-7 w-24 rounded-md border border-input bg-background px-2 font-mono text-xs uppercase focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <span
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium"
                style={{
                  backgroundColor: selectedColor.backgroundColor,
                  color: selectedColor.textColor,
                  borderColor: `${selectedColor.textColor}33`,
                }}
              >
                <CategoryIcon name={icon} className="h-3 w-3" />
                <span className="max-w-[110px] truncate">{name.trim() || 'Preview'}</span>
              </span>
            </div>
          )}
        </div>

        {/* Icon Picker */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="category-icon-search" className="font-semibold text-foreground">
              Icon Symbol
            </label>
            <span className="text-[11px] text-muted-foreground">{selectedIconLabel}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-input bg-muted/15">
            <div className="flex items-center gap-2 border-b border-border/60 bg-background/60 px-2.5 py-1.5">
              <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                id="category-icon-search"
                type="search"
                value={iconQuery}
                onChange={(event) => setIconQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault()
                  if (event.key === 'Escape' && iconQuery) {
                    event.stopPropagation()
                    setIconQuery('')
                  }
                }}
                placeholder={`Search ${AVAILABLE_CATEGORY_ICONS.length} icons…`}
                className="h-7 w-full bg-transparent text-xs focus:outline-none"
              />
              {iconQuery && (
                <button
                  type="button"
                  onClick={() => setIconQuery('')}
                  aria-label="Clear icon search"
                  className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="custom-scrollbar max-h-44 space-y-2.5 overflow-y-auto p-2">
              {visibleIconGroups.map((group) => (
                <div
                  key={group.label}
                  role="group"
                  aria-label={group.label}
                  className="space-y-1"
                >
                  <p className="px-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-7 gap-1 sm:grid-cols-10">
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
                          className={cn(
                            'flex h-8 cursor-pointer items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary shadow-xs'
                              : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {visibleIconGroups.length === 0 && (
                <p role="status" className="py-4 text-center text-xs text-muted-foreground">
                  No icons match &ldquo;{iconQuery.trim()}&rdquo;. Try another keyword.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="category-description" className="font-semibold text-foreground">
              Description
            </label>
            <span className="text-[11px] text-muted-foreground">Optional</span>
          </div>
          <input
            id="category-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short note about this category"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Active toggle when editing */}
        {isEditing && (
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/35">
            <span className="font-medium text-foreground">Active status</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-primary focus:ring-primary"
            />
          </label>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="cursor-pointer text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="min-w-[116px] cursor-pointer gap-1.5 text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <span>{isEditing ? 'Save Changes' : 'Create Category'}</span>
            )}
          </Button>
        </div>
      </form>
    </CategoryDialog>
  )
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = (props) => {
  if (!props.isOpen) return null

  const modalKey = props.category
    ? `edit-${props.category.id}`
    : `new-${props.initialParentId ?? 'root'}`

  return <CategoryFormInner key={modalKey} {...props} />
}
