import React from 'react'
import { AlertCircle, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BudgetWarningType } from '../types'

/** Base input styling shared with the app's existing modals. */
export const fieldInputClass =
  'w-full h-9 px-3 text-xs rounded-lg border border-input bg-background transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60'

export const fieldInvalidClass = 'border-destructive/60 focus:ring-destructive/40'

interface FormFieldProps {
  label: string
  htmlFor: string
  required?: boolean
  hint?: React.ReactNode
  error?: string
  className?: string
  children: React.ReactNode
}

/** Label + control + hint/error, with ids wired for aria-describedby (`${htmlFor}-hint` / `${htmlFor}-error`). */
export const FormField: React.FC<FormFieldProps> = ({ label, htmlFor, required, hint, error, className, children }) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
      {label}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
    {children}
    {error ? (
      <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1 text-[11px] font-medium text-destructive">
        <AlertCircle className="h-3 w-3 shrink-0" />
        {error}
      </p>
    ) : hint ? (
      <p id={`${htmlFor}-hint`} className="text-[11px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
    ) : null}
  </div>
)

interface AmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix: React.ReactNode
  invalid?: boolean
}

/** Numeric input with a leading currency/percent adornment. */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ prefix, invalid, className, ...props }, ref) => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
        {prefix}
      </span>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        step="0.01"
        aria-invalid={invalid || undefined}
        className={cn(fieldInputClass, 'pl-8 font-mono tabular-nums', invalid && fieldInvalidClass, className)}
        {...props}
      />
    </div>
  ),
)
AmountInput.displayName = 'AmountInput'

interface WarningTypeToggleProps {
  value: BudgetWarningType
  onChange: (value: BudgetWarningType) => void
  currencySymbol: string
  disabled?: boolean
  id?: string
}

/** Segmented control to switch between percentage and absolute-amount warning thresholds. */
export const WarningTypeToggle: React.FC<WarningTypeToggleProps> = ({ value, onChange, currencySymbol, disabled, id }) => {
  const options: { value: BudgetWarningType; label: string; icon: React.ReactNode }[] = [
    { value: 'PERCENTAGE', label: 'Percentage', icon: <Percent className="h-3 w-3" /> },
    { value: 'AMOUNT', label: 'Fixed amount', icon: <span className="text-[11px] font-bold">{currencySymbol}</span> },
  ]
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Warning type"
      className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/60 p-1"
      onKeyDown={(event) => {
        if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : value === 'PERCENTAGE' ? 1 : 0
        onChange(options[index].value)
        event.currentTarget.querySelectorAll('button')[index]?.focus()
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition-all',
              active ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
