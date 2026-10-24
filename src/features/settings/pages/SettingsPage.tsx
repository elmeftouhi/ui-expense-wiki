import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, ShieldAlert } from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { useConfiguration, useUpdateConfiguration } from '../hooks/useConfiguration'
import {
  CURRENCIES, LANGUAGES, configurationFormSchema, toConfigurationRequest, toFormValues,
  type ConfigurationFormValues,
} from '../schemas/configurationSchema'
import type { TenantConfiguration } from '../types'
import { PaymentMethodsSettings } from '@/features/payment-methods/PaymentMethodsSettings'

const LANGUAGE_NAMES: Record<(typeof LANGUAGES)[number], string> = {
  EN: 'English', FR: 'French', ES: 'Spanish', DE: 'German', AR: 'Arabic',
  ZH: 'Chinese', JA: 'Japanese', PT: 'Portuguese', RU: 'Russian', IT: 'Italian',
}
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function Field({ name, label, error, hint, children }: {
  name: keyof ConfigurationFormValues
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p id={`${name}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${name}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function SettingsSection({ title, description, children }: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(180px,1fr)_2fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function ConfigurationForm({ config, tenantId, isAdmin }: {
  config: TenantConfiguration
  tenantId: number | string
  isAdmin: boolean
}) {
  const update = useUpdateConfiguration(tenantId)
  const toast = useToast()
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ConfigurationFormValues>({
    resolver: zodResolver(configurationFormSchema),
    defaultValues: toFormValues(config),
  })
  useEffect(() => {
    if (!isDirty) reset(toFormValues(config))
  }, [config, isDirty, reset])

  const fieldProps = (name: keyof ConfigurationFormValues, hasHint = false) => ({
    id: name,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': [hasHint ? `${name}-hint` : '', errors[name] ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined,
  })
  const save = handleSubmit((values) => {
    if (!isAdmin || update.isPending) return
    update.mutate(toConfigurationRequest(values), {
      onSuccess: (saved) => {
        reset(toFormValues(saved))
        toast.success('Settings saved', 'Your workspace configuration has been updated.')
      },
    })
  })

  return (
    <form onSubmit={save} noValidate className="overflow-hidden rounded-lg border border-border bg-card">
      {!isAdmin && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-6 py-4 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Only administrators can update workspace settings. You have read-only access.
        </div>
      )}
      <fieldset disabled={!isAdmin || update.isPending} className="min-w-0 divide-y divide-border">
        <legend className="sr-only">Workspace configuration</legend>
        <SettingsSection title="Financial defaults" description="Currency, precision, and reporting preferences for this workspace.">
          <Field name="currency" label="Currency" error={errors.currency?.message}>
            <select {...fieldProps('currency')} {...register('currency')} className={selectClass}>
              {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </Field>
          <Field name="decimalPlaces" label="Decimal places" error={errors.decimalPlaces?.message}>
            <Input {...fieldProps('decimalPlaces')} {...register('decimalPlaces', { valueAsNumber: true })} type="number" min={0} step={1} />
          </Field>
          <Field name="expenseRoundingMethod" label="Expense rounding method" error={errors.expenseRoundingMethod?.message} hint="Use a method code supported by your server, such as NONE.">
            <Input {...fieldProps('expenseRoundingMethod', true)} {...register('expenseRoundingMethod')} />
          </Field>
          <Field name="reportingPeriod" label="Reporting period" error={errors.reportingPeriod?.message} hint="Use a period code supported by your server, such as CALENDAR_MONTH.">
            <Input {...fieldProps('reportingPeriod', true)} {...register('reportingPeriod')} />
          </Field>
        </SettingsSection>
        <SettingsSection title="Regional formats" description="Language, timezone, and calendar preferences stored for your workspace.">
          <Field name="language" label="Language" error={errors.language?.message}>
            <select {...fieldProps('language')} {...register('language')} className={selectClass}>
              {LANGUAGES.map((language) => <option key={language} value={language}>{LANGUAGE_NAMES[language]}</option>)}
            </select>
          </Field>
          <Field name="timezone" label="Timezone" error={errors.timezone?.message} hint="For example, UTC or Europe/Paris.">
            <Input {...fieldProps('timezone', true)} {...register('timezone')} />
          </Field>
          <Field name="dateFormat" label="Date format" error={errors.dateFormat?.message} hint="Use the server's date pattern, such as yyyy-MM-dd.">
            <Input {...fieldProps('dateFormat', true)} {...register('dateFormat')} />
          </Field>
          <Field name="timeFormat" label="Time format" error={errors.timeFormat?.message}>
            <select {...fieldProps('timeFormat')} {...register('timeFormat')} className={selectClass}>
              <option value="FORMAT_24H">24-hour</option>
              <option value="FORMAT_12H">12-hour</option>
            </select>
          </Field>
          <Field name="weekStartDay" label="Week starts on" error={errors.weekStartDay?.message}>
            <select {...fieldProps('weekStartDay')} {...register('weekStartDay')} className={selectClass}>
              <option value="MONDAY">Monday</option>
              <option value="SUNDAY">Sunday</option>
            </select>
          </Field>
        </SettingsSection>
        <SettingsSection title="Alerts & reminders" description="Choose when budget alerts and upcoming payment reminders are triggered.">
          <Field name="budgetAlertThreshold" label="Budget alert threshold (%)" error={errors.budgetAlertThreshold?.message} hint="Percentage of the budget used, from 0 to 100.">
            <Input {...fieldProps('budgetAlertThreshold', true)} {...register('budgetAlertThreshold', { valueAsNumber: true })} type="number" min={0} max={100} step={1} />
          </Field>
          <Field name="notificationChannels" label="Notification channels" error={errors.notificationChannels?.message} hint="Comma-separated channel codes, such as IN_APP. Leave empty for no channels.">
            <Input {...fieldProps('notificationChannels', true)} {...register('notificationChannels')} placeholder="IN_APP" />
          </Field>
          <Field name="autoPaymentReminderDays" label="Payment reminder days" error={errors.autoPaymentReminderDays?.message} hint="Days before payment, separated by commas (3, 7). Leave empty for no reminders.">
            <Input {...fieldProps('autoPaymentReminderDays', true)} {...register('autoPaymentReminderDays')} placeholder="3, 7" />
          </Field>
        </SettingsSection>
      </fieldset>
      <div className="space-y-4 border-t border-border px-5 py-4 sm:px-6">
        {update.error && <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(update.error)}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {update.isPending ? 'Saving settings...' : isDirty ? 'You have unsaved changes.' : 'Settings are up to date.'}
          </p>
          {isAdmin && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={!isDirty || update.isPending} onClick={() => { reset(toFormValues(config)); update.reset() }}>
                Discard changes
              </Button>
              <Button type="submit" disabled={!isDirty || update.isPending}>
                <Save className="h-4 w-4" />
                {update.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          )}
        </div>
      </div>
      <details className="border-t border-border px-5 py-4 sm:px-6">
        <summary className="cursor-pointer text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Configuration details</summary>
        <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Configuration ID', config.id], ['Tenant ID', config.tenantId],
            ['Created at', new Date(config.createdAt).toLocaleString()],
            ['Updated at', new Date(config.updatedAt).toLocaleString()],
            ['Created by', config.createdBy ?? 'Not recorded'], ['Updated by', config.updatedBy ?? 'Not recorded'],
          ].map(([label, value]) => (
            <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>
          ))}
        </dl>
      </details>
    </form>
  )
}

function TenantSettings({ tenantId, isAdmin }: { tenantId: number | string; isAdmin: boolean }) {
  const query = useConfiguration(tenantId)
  if (query.isPending) return <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading workspace settings...</p>
  return (
    <div className="space-y-4">
      {query.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-card p-5">
          <p className="text-sm text-destructive">{getApiErrorMessage(query.error)}</p>
          <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Reload settings</Button>
        </div>
      )}
      {query.data && <ConfigurationForm config={query.data} tenantId={tenantId} isAdmin={isAdmin} />}
    </div>
  )
}

export function SettingsPage() {
  const { activeTenant, currentRole, isAdmin } = useActiveTenant()
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Organization settings</h1>
            <Badge variant="outline" className="text-xs">{activeTenant.name}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Manage financial defaults, regional formats, and reminders for your workspace.</p>
        </div>
        <Badge variant={isAdmin ? 'default' : 'secondary'} className="self-start sm:self-auto">{currentRole} access</Badge>
      </div>
      <TenantSettings key={activeTenant.id} tenantId={activeTenant.id} isAdmin={isAdmin} />
      <PaymentMethodsSettings key={`payment-methods-${activeTenant.id}`} isAdmin={isAdmin} />
    </div>
  )
}
