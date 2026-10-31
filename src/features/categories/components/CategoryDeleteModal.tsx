import React, { useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import type { Category } from '../types'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/api-error'
import { CategoryDialog } from './CategoryDialog'

export interface CategoryDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  category: Category | null
  hasSubcategories?: boolean
}

const CategoryDeleteInner: React.FC<{
  onClose: () => void
  onConfirm: () => Promise<void>
  category: Category
  hasSubcategories: boolean
}> = ({ onClose, onConfirm, category, hasSubcategories }) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <CategoryDialog
      title="Delete category"
      onClose={onClose}
      dismissible={!isDeleting}
      className="sm:max-w-md"
    >
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3 text-xs text-muted-foreground">
        <p className="leading-relaxed">
          Delete <strong className="font-semibold text-foreground">&ldquo;{category.name}&rdquo;</strong>? This action cannot be undone.
        </p>

        {hasSubcategories && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This category contains subcategories that may also be removed or unlinked.
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isDeleting}
          className="cursor-pointer text-xs"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="min-w-[96px] cursor-pointer gap-1.5 text-xs"
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Deleting…</span>
            </>
          ) : (
            <>
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </>
          )}
        </Button>
      </div>
    </CategoryDialog>
  )
}

export const CategoryDeleteModal: React.FC<CategoryDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  category,
  hasSubcategories = false,
}) => {
  if (!isOpen || !category) return null
  return (
    <CategoryDeleteInner
      key={category.id}
      onClose={onClose}
      onConfirm={onConfirm}
      category={category}
      hasSubcategories={hasSubcategories}
    />
  )
}
