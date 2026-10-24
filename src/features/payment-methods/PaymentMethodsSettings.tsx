import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { fieldInputClass } from '@/features/budgets/components/FormControls'
import { getApiErrorMessage } from '@/lib/api-error'
import { paymentMethodRequestSchema, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_TYPES, type PaymentMethod, type PaymentMethodRequest } from './paymentMethodService'
import { usePaymentMethods, useSavePaymentMethod } from './usePaymentMethods'

function PaymentMethodForm({ method, onClose }: { method: PaymentMethod | null; onClose: () => void }) {
  const save = useSavePaymentMethod()
  const toast = useToast()
  const { register, handleSubmit, control, formState: { errors } } = useForm<PaymentMethodRequest>({
    resolver: zodResolver(paymentMethodRequestSchema),
    defaultValues: method ?? { name: '', type: 'CASH', active: true, isDefault: false },
  })
  const active = useWatch({ control, name: 'active' })
  return (
    <form noValidate className="space-y-4 border-t border-border p-5 sm:p-6" onSubmit={handleSubmit((payload) => {
      save.mutate(method ? { action: 'update', id: method.id, payload } : { action: 'create', payload }, {
        onSuccess: () => { toast.success(method ? 'Payment method updated' : 'Payment method added'); onClose() },
      })
    })}>
      <h3 className="font-medium">{method ? 'Edit payment method' : 'Add payment method'}</h3>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <label htmlFor="payment-method-name">Name</label>
          <input id="payment-method-name" autoFocus className={fieldInputClass} {...register('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'payment-method-name-error' : undefined} />
          {errors.name && <p id="payment-method-name-error" role="alert" className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <label className="space-y-1.5 text-sm">Type
          <select className={fieldInputClass} {...register('type')}>
            {PAYMENT_METHOD_TYPES.map((type) => <option key={type} value={type}>{PAYMENT_METHOD_LABELS[type]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('active')} disabled={method?.isDefault} />Active</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('isDefault')} disabled={method?.isDefault || !active} />Default payment method</label>
        {errors.active && <p role="alert" className="text-sm text-destructive sm:col-span-2">{errors.active.message}</p>}
      </fieldset>
      {save.error && <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(save.error)}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save payment method'}</Button>
      </div>
    </form>
  )
}

export function PaymentMethodsSettings({ isAdmin }: { isAdmin: boolean }) {
  const query = usePaymentMethods(true)
  const save = useSavePaymentMethod()
  const toast = useToast()
  const [editing, setEditing] = useState<PaymentMethod | null | undefined>()
  const [removing, setRemoving] = useState<PaymentMethod | null>(null)
  return (
    <section aria-labelledby="payment-methods-heading" className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <div><h2 id="payment-methods-heading" className="font-semibold">Payment methods</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose how you pay. The default is selected for new expenses and subscriptions.</p></div>
        {isAdmin && <Button variant="outline" disabled={editing !== undefined || save.isPending} onClick={() => { save.reset(); setRemoving(null); setEditing(null) }}>Add payment method</Button>}
      </header>
      {!isAdmin && <p className="px-5 pb-4 text-sm text-muted-foreground">Only administrators can manage payment methods.</p>}
      {query.isPending && <p role="status" className="px-5 pb-5 text-sm text-muted-foreground">Loading payment methods...</p>}
      {query.error && <p role="alert" className="px-5 pb-5 text-sm text-destructive">{getApiErrorMessage(query.error)} <button className="underline" onClick={() => void query.refetch()}>Reload payment methods</button></p>}
      {query.data?.length === 0 && <p className="px-5 pb-5 text-sm text-muted-foreground">No payment methods yet. Add a method to start recording payments.</p>}
      <ul className="divide-y divide-border">
        {query.data?.map((method) => <li key={method.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          <div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{method.name}</span>{method.isDefault && <Badge>Default</Badge>}{!method.active && <Badge variant="secondary">Inactive</Badge>}</div>
            <p className="mt-1 text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[method.type]}</p></div>
          {isAdmin && <div className="flex flex-wrap gap-2">
            {method.active && !method.isDefault && <Button size="sm" variant="ghost" disabled={save.isPending || editing !== undefined} onClick={() => save.mutate({ action: 'set-default', id: method.id }, { onSuccess: () => toast.success('Default payment method updated') })}>Set default</Button>}
            <Button size="sm" variant="outline" aria-label={`Edit ${method.name}`} disabled={save.isPending || editing !== undefined} onClick={() => { save.reset(); setRemoving(null); setEditing(method) }}>Edit</Button>
            {method.active && <Button size="sm" variant="ghost" aria-label={`Remove ${method.name}`} disabled={method.isDefault || save.isPending || editing !== undefined} title={method.isDefault ? 'Set another method as default before removing this one.' : undefined} onClick={() => { save.reset(); setRemoving(method) }}>Remove</Button>}
          </div>}
        </li>)}
      </ul>
      {isAdmin && removing && <div className="space-y-3 border-t border-border p-5" role="group" aria-label="Confirm payment method removal">
        <p className="text-sm">Remove {removing.name}? It will be deactivated, preserving existing payment records. Set another method as default before removing the current default.</p>
        <div className="flex gap-2"><Button variant="outline" disabled={save.isPending} onClick={() => setRemoving(null)}>Cancel removal</Button>
          <Button variant="destructive" disabled={save.isPending} onClick={() => save.mutate({ action: 'update', id: removing.id, payload: { ...removing, active: false, isDefault: false } }, { onSuccess: () => { toast.success('Payment method removed'); setRemoving(null) } })}>Confirm removal</Button></div>
      </div>}
      {save.error && <p role="alert" className="px-5 py-3 text-sm text-destructive">{getApiErrorMessage(save.error)}</p>}
      {isAdmin && editing !== undefined && <PaymentMethodForm key={editing?.id ?? 'new'} method={editing} onClose={() => setEditing(undefined)} />}
    </section>
  )
}
