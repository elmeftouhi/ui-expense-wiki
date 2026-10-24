import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { Category } from '../types'

export function useCategoryDragReorder({
  disabled, siblingsFor, onMove,
}: {
  disabled: boolean
  siblingsFor: (category: Category) => Category[]
  onMove: (category: Category, level: number) => void
}) {
  const source = useRef<Category | null>(null)
  const preview = useRef<{ element: HTMLElement; offsetX: number; offsetY: number } | null>(null)
  const dragImage = useRef<HTMLCanvasElement | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [target, setTarget] = useState<{ id: number; edge: 'before' | 'after' } | null>(null)

  useEffect(() => {
    const followCursor = (event: globalThis.DragEvent) => {
      const current = preview.current
      if (!current) return
      current.element.style.left = `${event.clientX - current.offsetX}px`
      current.element.style.top = `${event.clientY - current.offsetY}px`
    }
    document.addEventListener('dragover', followCursor)
    return () => {
      document.removeEventListener('dragover', followCursor)
      preview.current?.element.remove()
      dragImage.current?.remove()
    }
  }, [])

  const clear = () => {
    preview.current?.element.remove()
    preview.current = null
    dragImage.current?.remove()
    dragImage.current = null
    source.current = null
    setDraggedId(null)
    setTarget(null)
  }
  const destination = (category: Category, event: DragEvent<HTMLElement>) => {
    const dragged = source.current
    if (disabled || !dragged || dragged.id === category.id
      || (dragged.parentCategoryId ?? null) !== (category.parentCategoryId ?? null)) return null
    const siblings = siblingsFor(category)
    const sourceIndex = siblings.findIndex((item) => item.id === dragged.id)
    const targetIndex = siblings.findIndex((item) => item.id === category.id)
    if (sourceIndex < 0 || targetIndex < 0) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const edge: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    const insertionIndex = targetIndex + (edge === 'after' ? 1 : 0)
    const level = insertionIndex - (sourceIndex < insertionIndex ? 1 : 0) + 1
    return level === sourceIndex + 1 ? null : { dragged, edge, level }
  }

  return {
    handleProps: (category: Category) => ({
      draggable: !disabled && siblingsFor(category).length > 1,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation()
        if (disabled || siblingsFor(category).length < 2) {
          event.preventDefault()
          return
        }
        source.current = category
        setDraggedId(category.id)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(category.id))
        const row = event.currentTarget.closest<HTMLElement>('[data-category-row]')
        if (row) {
          preview.current?.element.remove()
          dragImage.current?.remove()
          const rect = row.getBoundingClientRect()
          const element = row.cloneNode(true)
          if (element instanceof HTMLElement) {
            element.removeAttribute('data-category-row')
            element.setAttribute('data-category-drag-preview', '')
            element.setAttribute('aria-hidden', 'true')
            element.inert = true
            element.querySelectorAll('[id]').forEach((child) => child.removeAttribute('id'))
            Object.assign(element.style, {
              position: 'fixed',
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              margin: '0',
              pointerEvents: 'none',
              zIndex: '9999',
              opacity: '1',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 'var(--radius)',
              boxShadow: '0 12px 32px rgb(0 0 0 / 0.2)',
              transition: 'none',
            })
            document.body.appendChild(element)
            preview.current = {
              element, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
            }
            const image = document.createElement('canvas')
            image.width = image.height = 1
            image.style.position = 'fixed'
            image.style.pointerEvents = 'none'
            document.body.appendChild(image)
            dragImage.current = image
            event.dataTransfer.setDragImage(image, 0, 0)
          }
        }
      },
      onDragEnd: clear,
    }),
    rowProps: (category: Category) => ({
      'data-category-row': category.id,
      'data-drop-edge': !disabled && target?.id === category.id ? target.edge : undefined,
      style: {
        opacity: draggedId === category.id ? 0.5 : undefined,
        boxShadow: !disabled && target?.id === category.id
          ? `inset 0 ${target.edge === 'before' ? '3px' : '-3px'} 0 hsl(var(--primary))`
          : undefined,
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation()
        const next = destination(category, event)
        if (!next) {
          event.dataTransfer.dropEffect = 'none'
          setTarget(null)
          return
        }
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setTarget({ id: category.id, edge: next.edge })
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setTarget((current) => current?.id === category.id ? null : current)
        }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation()
        const next = destination(category, event)
        if (next) {
          event.preventDefault()
          onMove(next.dragged, next.level)
        }
        clear()
      },
    }),
  }
}
