import { useState, type ComponentType } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Banknote,
  CreditCard,
  Edit2,
  FileCheck2,
  Landmark,
  Loader2,
  Plus,
  Smartphone,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { fieldInputClass } from '@/features/budgets/components/FormControls'
import { SettingsDialog } from '@/features/settings/components/SettingsDialog'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import {
  paymentMethodRequestSchema,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_TYPES,
  type PaymentMethod,
  type PaymentMethodRequest,
} from './paymentMethodService'
import { usePaymentMethods, useSavePaymentMethod } from './usePaymentMethods'

const PAYMENT_TYPE_ICONS: Record<(typeof PAYMENT_METHOD_TYPES)[number], ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: CreditCard,
  BANK_TRANSFER: Landmark,
  DIGITAL_WALLET: Smartphone,
  CHECK: FileCheck2,
  OTHER: Wallet,
}

function PaymentMethodModal({
  method,
  onClose,
}: {
  method: PaymentMethod | null
  onClose: () => void
}) {
  const save = useSavePaymentMethod()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PaymentMethodRequest>({
    resolver: zodResolver(paymentMethodRequestSchema),
    defaultValues: method ?? { name: '', type: 'CASH', active: true, isDefault: false },
  })
  const active = useWatch({ control, name: 'active' })

  return (
    <SettingsDialog
      title={method ? 'Edit payment method' : 'Add payment method'}
      onClose={onClose}
      dismissible={!save.isPending}
    >
      <form
        noValidate
        className="space-y-4 text-xs"
        onSubmit={handleSubmit((payload) => {
          save.mutate(
            method ? { action: 'update', id: method.id, payload } : { action: 'create', payload },
            {
              onSuccess: () => {
                toast.success(method ? 'Payment method updated' : 'Payment method added')
                onClose()
              },
            },
          )
        })}
      >
        {save.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{getApiErrorMessage(save.error)}</span>
          </div>
        )}

        <fieldset disabled={save.isPending} className="space-y-3.5">
          <div className="space-y-1.5">
            <label htmlFor="payment-method-name" className="font-semibold text-foreground">
              Name
            </label>
            <input
              id="payment-method-name"
              autoFocus
              placeholder="e.g. Corporate Visa, Main Checking…"
              className={fieldInputClass}
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'payment-method-name-error' : undefined}
            />
            {errors.name && (
              <p id="payment-method-name-error" role="alert" className="text-[11px] text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="payment-method-type" className="font-semibold text-foreground">
              Type
            </label>
            <select
              id="payment-method-type"
              className={fieldInputClass}
              {...register('type')}
            >
              {PAYMENT_METHOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PAYMENT_METHOD_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/35">
              <span className="font-medium text-foreground">Active</span>
              <input
                type="checkbox"
                {...register('active')}
                disabled={method?.isDefault}
                className="h-4 w-4 cursor-pointer rounded accent-primary disabled:opacity-50"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/35">
              <span className="font-medium text-foreground">Default payment method</span>
              <input
                type="checkbox"
                {...register('isDefault')}
                disabled={method?.isDefault || !active}
                className="h-4 w-4 cursor-pointer rounded accent-primary disabled:opacity-50"
              />
            </label>
          </div>

          {errors.active && (
            <p role="alert" className="text-[11px] text-destructive">
              {errors.active.message}
            </p>
          )}
        </fieldset>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={save.isPending}
            onClick={onClose}
            className="cursor-pointer text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={save.isPending}
            className="min-w-[132px] cursor-pointer gap-1.5 text-xs"
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save payment method</span>
            )}
          </Button>
        </div>
      </form>
    </SettingsDialog>
  )
}

export function PaymentMethodsSettings({ isAdmin }: { isAdmin: boolean }) {
  const query = usePaymentMethods(true)
  const save = useSavePaymentMethod()
  const toast = useToast()
  const [editing, setEditing] = useState<PaymentMethod | null | undefined>()
  const [removing, setRemoving] = useState<PaymentMethod | null>(null)

  return (
    <section
      aria-labelledby="payment-methods-heading"
      className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 id="payment-methods-heading" className="text-sm font-semibold text-foreground">
            Payment methods
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Default method is preselected for new expenses and subscriptions.
          </p>
        </div>

        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            disabled={editing !== undefined || save.isPending}
            onClick={() => {
              save.reset()
              setRemoving(null)
              setEditing(null)
            }}
            className="h-8 shrink-0 cursor-pointer gap-1.5 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add payment method</span>
          </Button>
        )}
      </header>

      {!isAdmin && (
        <div className="border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          Only administrators can manage payment methods.
        </div>
      )}

      {query.isPending && (
        <div role="status" className="px-5 py-10 text-center text-xs text-muted-foreground">
          Loading payment methods...
        </div>
      )}

      {query.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-destructive">
          <span>{getApiErrorMessage(query.error)}</span>
          <button
            type="button"
            className="cursor-pointer font-medium underline"
            onClick={() => void query.refetch()}
          >
            Reload payment methods
          </button>
        </div>
      )}

      {query.data?.length === 0 && (
        <div className="px-5 py-10 text-center text-xs text-muted-foreground">
          No payment methods yet. Add a method to start recording payments.
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <ul className="divide-y divide-border/60">
          {query.data.map((method) => {
            const TypeIcon = PAYMENT_TYPE_ICONS[method.type] ?? Wallet
            return (
              <li
                key={method.id}
                className={cn(
                  'flex flex-col gap-2.5 px-4 py-3 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5',
                  !method.active && 'bg-muted/15',
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground',
                      method.isDefault && 'border-primary/25 bg-primary/10 text-primary',
                      !method.active && 'opacity-60',
                    )}
                  >
                    <TypeIcon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'truncate text-xs font-semibold sm:text-[13px]',
                          method.active ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {method.name}
                      </span>
                      {method.isDefault && (
                        <Badge className="h-4 px-1.5 py-0 text-[10px] font-medium">Default</Badge>
                      )}
                      {!method.active && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[method.type]}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pl-11 sm:pl-0">
                    {method.active && !method.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={save.isPending || editing !== undefined}
                        onClick={() =>
                          save.mutate(
                            { action: 'set-default', id: method.id },
                            { onSuccess: () => toast.success('Default payment method updated') },
                          )
                        }
                        className="h-7 cursor-pointer gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Star className="h-3 w-3" />
                        <span>Set default</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Edit ${method.name}`}
                      disabled={save.isPending || editing !== undefined}
                      onClick={() => {
                        save.reset()
                        setRemoving(null)
                        setEditing(method)
                      }}
                      className="h-7 cursor-pointer gap-1 px-2.5 text-xs"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Edit</span>
                    </Button>

                    {method.active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${method.name}`}
                        disabled={method.isDefault || save.isPending || editing !== undefined}
                        title={
                          method.isDefault
                            ? 'Set another method as default before removing this one.'
                            : undefined
                        }
                        onClick={() => {
                          save.reset()
                          setRemoving(method)
                        }}
                        className="h-7 cursor-pointer gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {save.error && editing === undefined && !removing && (
        <div role="alert" className="border-t border-border/60 bg-destructive/5 px-5 py-3 text-xs text-destructive">
          {getApiErrorMessage(save.error)}
        </div>
      )}

      {isAdmin && removing && (
        <SettingsDialog
          title="Remove payment method"
          onClose={() => setRemoving(null)}
          dismissible={!save.isPending}
        >
          <div className="space-y-3 text-xs text-muted-foreground" role="group" aria-label="Confirm payment method removal">
            <p className="leading-relaxed">
              Deactivate <strong className="font-semibold text-foreground">{removing.name}</strong>? Existing payment history will be preserved.
            </p>
            {save.error && (
              <p role="alert" className="text-xs text-destructive">
                {getApiErrorMessage(save.error)}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => setRemoving(null)}
                className="cursor-pointer text-xs"
              >
                Cancel removal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate(
                    {
                      action: 'update',
                      id: removing.id,
                      payload: { ...removing, active: false, isDefault: false },
                    },
                    {
                      onSuccess: () => {
                        toast.success('Payment method removed')
                        setRemoving(null)
                      },
                    },
                  )
                }
                className="cursor-pointer text-xs"
              >
                Confirm removal
              </Button>
            </div>
          </div>
        </SettingsDialog>
      )}

      {isAdmin && editing !== undefined && (
        <PaymentMethodModal
          key={editing?.id ?? 'new'}
          method={editing}
          onClose={() => {
            save.reset()
            setEditing(undefined)
          }}
        />
      )}
    </section>
  )
}
