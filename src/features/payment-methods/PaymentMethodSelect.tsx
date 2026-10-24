import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { fieldInputClass } from '@/features/budgets/components/FormControls'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePaymentMethods } from './usePaymentMethods'

export function PaymentMethodSelect({ id, value, onChange, onBlur, inputRef, fallbackLabel, filter = false, invalid = false }: {
  id: string
  value?: number | null
  onChange: (id: number | undefined) => void
  onBlur?: () => void
  inputRef?: Ref<HTMLSelectElement>
  fallbackLabel?: string | null
  filter?: boolean
  invalid?: boolean
}) {
  const query = usePaymentMethods(filter)
  const options = query.data ?? []
  const missing = !query.isPending && !query.error && value != null && !options.some((method) => method.id === value)
  return (
    <div className="space-y-1.5">
      <select id={id} aria-label={filter ? 'Filter by payment method' : 'Payment method'} aria-invalid={invalid || (!filter && missing)} aria-describedby={`${id}-hint`} ref={inputRef}
        className={`${fieldInputClass} text-sm font-normal`} value={value ?? ''} disabled={query.isPending || !!query.error}
        onBlur={onBlur} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : undefined)}>
        <option value="" disabled={!filter}>{query.isPending ? 'Loading payment methods...' : filter ? 'All payment methods' : 'Choose a payment method'}</option>
        {missing && <option value={value ?? ''} disabled>{fallbackLabel || 'Unavailable payment method'} (inactive)</option>}
        {options.map((method) => <option key={method.id} value={method.id}>{method.name}{!method.active ? ' (inactive)' : method.isDefault ? ' (default)' : ''}</option>)}
      </select>
      <div id={`${id}-hint`} className="text-xs font-normal">
        {query.error ? <p role="alert" className="text-destructive">{getApiErrorMessage(query.error)} <button type="button" className="underline" onClick={() => void query.refetch()}>Retry payment methods</button></p>
          : !filter && missing ? <p role="alert" className="text-destructive">Choose an active payment method before saving.</p>
          : !filter && !query.isPending && !options.length ? <p className="text-muted-foreground">No active payment methods. Add one in <Link className="underline" to="/settings">Settings</Link>.</p> : null}
      </div>
    </div>
  )
}
