import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Save, ShieldAlert } from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
import { PaymentMethodsSettings } from '@/features/payment-methods/PaymentMethodsSettings'
import { usePaymentMethods } from '@/features/payment-methods/usePaymentMethods'
import {
  SETTINGS_SECTIONS,
  groupSettingsSections,
  isSettingsSectionId,
  type SettingsSectionId,
} from '../config/settingsSections'
import { useConfiguration, useUpdateConfiguration } from '../hooks/useConfiguration'
import {
  CURRENCIES,
  LANGUAGES,
  configurationFormSchema,
  toConfigurationRequest,
  toFormValues,
  type ConfigurationFormValues,
} from '../schemas/configurationSchema'
import type { TenantConfiguration } from '../types'

const LANGUAGE_NAMES: Record<(typeof LANGUAGES)[number], string> = {
  EN: 'English',
  FR: 'French',
  ES: 'Spanish',
  DE: 'German',
  AR: 'Arabic',
  ZH: 'Chinese',
  JA: 'Japanese',
  PT: 'Portuguese',
  RU: 'Russian',
  IT: 'Italian',
}

const CURRENCY_LABELS: Record<(typeof CURRENCIES)[number], string> = {
  USD: 'USD — US Dollar ($)',
  EUR: 'EUR — Euro (€)',
  GBP: 'GBP — British Pound (£)',
  CAD: 'CAD — Canadian Dollar ($)',
  AUD: 'AUD — Australian Dollar ($)',
  JPY: 'JPY — Japanese Yen (¥)',
  CNY: 'CNY — Chinese Yuan (¥)',
  INR: 'INR — Indian Rupee (₹)',
  SAR: 'SAR — Saudi Riyal',
  AED: 'AED — UAE Dirham',
}

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Casablanca',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const COMMON_DATE_FORMATS = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd.MM.yyyy']
const COMMON_ROUNDING_METHODS = ['NONE', 'HALF_UP', 'UP', 'DOWN']
const COMMON_REPORTING_PERIODS = ['CALENDAR_MONTH', 'QUARTERLY', 'YEARLY', 'FISCAL_YEAR']
const QUICK_CHANNELS = ['IN_APP', 'EMAIL', 'PUSH'] as const

function readInitialSectionFromLocation(): SettingsSectionId | null {
  if (typeof window === 'undefined') return null
  const param = new URLSearchParams(window.location.search).get('section')
  return isSettingsSectionId(param) ? param : null
}

function SettingRow({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: keyof ConfigurationFormValues
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-start sm:gap-6 sm:px-5">
      <div className="min-w-0">
        <label htmlFor={name} className="block text-xs font-semibold text-foreground sm:pt-1.5">
          {label}
        </label>
        {hint && (
          <p id={`${name}-hint`} className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <div className="min-w-0 space-y-1">
        {children}
        {error && (
          <p id={`${name}-error`} role="alert" className="flex items-center gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function WorkspaceConfigurationForm({
  config,
  tenantId,
  isAdmin,
  activeSection,
  onSelectSection,
}: {
  config: TenantConfiguration
  tenantId: number | string
  isAdmin: boolean
  activeSection: Exclude<SettingsSectionId, 'payment-methods'>
  onSelectSection: (section: SettingsSectionId) => void
}) {
  const update = useUpdateConfiguration(tenantId)
  const toast = useToast()

  const {
    register,
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ConfigurationFormValues>({
    resolver: zodResolver(configurationFormSchema),
    defaultValues: toFormValues(config),
  })

  useEffect(() => {
    if (!isDirty) reset(toFormValues(config))
  }, [config, isDirty, reset])

  const channelsRaw = useWatch({ control, name: 'notificationChannels' }) ?? ''
  const selectedChannelSet = useMemo(
    () =>
      new Set(
        channelsRaw
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      ),
    [channelsRaw],
  )

  const toggleQuickChannel = (code: string) => {
    if (!isAdmin || update.isPending) return
    const next = new Set(selectedChannelSet)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setValue('notificationChannels', Array.from(next).join(', '), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const fieldProps = (name: keyof ConfigurationFormValues, hasHint = false) => ({
    id: name,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby':
      [hasHint ? `${name}-hint` : '', errors[name] ? `${name}-error` : '']
        .filter(Boolean)
        .join(' ') || undefined,
  })

  const inputClassFor = (name: keyof ConfigurationFormValues, extra?: string) =>
    cn(fieldInputClass, errors[name] && fieldInvalidClass, extra)

  const save = handleSubmit(
    (values) => {
      if (!isAdmin || update.isPending) return
      update.mutate(toConfigurationRequest(values), {
        onSuccess: (saved) => {
          reset(toFormValues(saved))
          toast.success('Settings saved', 'Your workspace configuration has been updated.')
        },
      })
    },
    (fieldErrors) => {
      // If validation failed on a field in a different section, jump directly to it
      const activeMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection)
      const activeHasError = activeMeta?.configFields?.some((f) => Boolean(fieldErrors[f]))
      if (!activeHasError) {
        const firstSectionWithError = SETTINGS_SECTIONS.find((s) =>
          s.configFields?.some((f) => Boolean(fieldErrors[f])),
        )
        if (firstSectionWithError) onSelectSection(firstSectionWithError.id)
      }
    },
  )

  const sectionMeta =
    SETTINGS_SECTIONS.find((s) => s.id === activeSection) ?? SETTINGS_SECTIONS[0]

  return (
    <form
      onSubmit={save}
      noValidate
      className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs"
    >
      {/* Active Section Header */}
      <div className="border-b border-border/60 px-4 py-3.5 sm:px-5 sm:py-4">
        <h2 className="text-sm font-semibold text-foreground">{sectionMeta.label}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{sectionMeta.description}</p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>Only administrators can update workspace settings. You have read-only access.</span>
        </div>
      )}

      <fieldset disabled={!isAdmin || update.isPending} className="min-w-0">
        <legend className="sr-only">Workspace configuration</legend>

        {/* 1. Financial Section */}
        <div
          role="region"
          aria-label="Financial settings"
          className={cn(
            'divide-y divide-border/50',
            activeSection !== 'financial' && 'hidden',
          )}
        >
          <SettingRow name="currency" label="Currency" error={errors.currency?.message}>
            <select
              {...fieldProps('currency')}
              {...register('currency')}
              className={inputClassFor('currency')}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {CURRENCY_LABELS[currency]}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            name="decimalPlaces"
            label="Decimal places"
            hint="Digits displayed after the decimal separator."
            error={errors.decimalPlaces?.message}
          >
            <input
              {...fieldProps('decimalPlaces', true)}
              {...register('decimalPlaces', { valueAsNumber: true })}
              type="number"
              min={0}
              max={6}
              step={1}
              className={inputClassFor('decimalPlaces', 'font-mono tabular-nums')}
            />
          </SettingRow>

          <SettingRow
            name="expenseRoundingMethod"
            label="Expense rounding method"
            error={errors.expenseRoundingMethod?.message}
          >
            <input
              {...fieldProps('expenseRoundingMethod')}
              {...register('expenseRoundingMethod')}
              list="rounding-methods-datalist"
              className={inputClassFor('expenseRoundingMethod', 'font-mono')}
            />
            <datalist id="rounding-methods-datalist">
              {COMMON_ROUNDING_METHODS.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
          </SettingRow>

          <SettingRow
            name="reportingPeriod"
            label="Reporting period"
            error={errors.reportingPeriod?.message}
          >
            <input
              {...fieldProps('reportingPeriod')}
              {...register('reportingPeriod')}
              list="reporting-periods-datalist"
              className={inputClassFor('reportingPeriod', 'font-mono')}
            />
            <datalist id="reporting-periods-datalist">
              {COMMON_REPORTING_PERIODS.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
          </SettingRow>
        </div>

        {/* 2. Regional Section */}
        <div
          role="region"
          aria-label="Regional settings"
          className={cn(
            'divide-y divide-border/50',
            activeSection !== 'regional' && 'hidden',
          )}
        >
          <SettingRow name="language" label="Language" error={errors.language?.message}>
            <select
              {...fieldProps('language')}
              {...register('language')}
              className={inputClassFor('language')}
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {LANGUAGE_NAMES[language]}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            name="timezone"
            label="Timezone"
            hint="IANA timezone such as UTC or Europe/Paris."
            error={errors.timezone?.message}
          >
            <input
              {...fieldProps('timezone', true)}
              {...register('timezone')}
              list="timezones-datalist"
              className={inputClassFor('timezone')}
            />
            <datalist id="timezones-datalist">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </SettingRow>

          <SettingRow
            name="dateFormat"
            label="Date format"
            hint="Pattern such as yyyy-MM-dd or dd/MM/yyyy."
            error={errors.dateFormat?.message}
          >
            <input
              {...fieldProps('dateFormat', true)}
              {...register('dateFormat')}
              list="date-formats-datalist"
              className={inputClassFor('dateFormat', 'font-mono')}
            />
            <datalist id="date-formats-datalist">
              {COMMON_DATE_FORMATS.map((fmt) => (
                <option key={fmt} value={fmt} />
              ))}
            </datalist>
          </SettingRow>

          <SettingRow name="timeFormat" label="Time format" error={errors.timeFormat?.message}>
            <select
              {...fieldProps('timeFormat')}
              {...register('timeFormat')}
              className={inputClassFor('timeFormat')}
            >
              <option value="FORMAT_24H">24-hour</option>
              <option value="FORMAT_12H">12-hour</option>
            </select>
          </SettingRow>

          <SettingRow name="weekStartDay" label="Week starts on" error={errors.weekStartDay?.message}>
            <select
              {...fieldProps('weekStartDay')}
              {...register('weekStartDay')}
              className={inputClassFor('weekStartDay')}
            >
              <option value="MONDAY">Monday</option>
              <option value="SUNDAY">Sunday</option>
            </select>
          </SettingRow>
        </div>

        {/* 3. Alerts & Reminders Section */}
        <div
          role="region"
          aria-label="Alerts and reminders settings"
          className={cn(
            'divide-y divide-border/50',
            activeSection !== 'alerts' && 'hidden',
          )}
        >
          <SettingRow
            name="budgetAlertThreshold"
            label="Budget alert threshold (%)"
            hint="Percentage of budget used before warning (0–100)."
            error={errors.budgetAlertThreshold?.message}
          >
            <input
              {...fieldProps('budgetAlertThreshold', true)}
              {...register('budgetAlertThreshold', { valueAsNumber: true })}
              type="number"
              min={0}
              max={100}
              step={1}
              className={inputClassFor('budgetAlertThreshold', 'font-mono tabular-nums')}
            />
          </SettingRow>

          <SettingRow
            name="notificationChannels"
            label="Notification channels"
            hint="Comma-separated channel codes (or toggle quick presets)."
            error={errors.notificationChannels?.message}
          >
            <input
              {...fieldProps('notificationChannels', true)}
              {...register('notificationChannels')}
              placeholder="IN_APP"
              className={inputClassFor('notificationChannels', 'font-mono')}
            />
            {isAdmin && (
              <div className="flex flex-wrap gap-1 pt-1">
                {QUICK_CHANNELS.map((code) => {
                  const active = selectedChannelSet.has(code)
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleQuickChannel(code)}
                      aria-pressed={active}
                      className={cn(
                        'cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {code}
                    </button>
                  )
                })}
              </div>
            )}
          </SettingRow>

          <SettingRow
            name="autoPaymentReminderDays"
            label="Payment reminder days"
            hint="Days before due date, comma-separated (e.g. 3, 7)."
            error={errors.autoPaymentReminderDays?.message}
          >
            <input
              {...fieldProps('autoPaymentReminderDays', true)}
              {...register('autoPaymentReminderDays')}
              placeholder="3, 7"
              className={inputClassFor('autoPaymentReminderDays', 'font-mono tabular-nums')}
            />
          </SettingRow>
        </div>
      </fieldset>

      {/* Save / Discard Action Footer */}
      <div className="space-y-3 border-t border-border/60 bg-muted/15 px-4 py-3 sm:px-5">
        {update.error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{getApiErrorMessage(update.error)}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {update.isPending
              ? 'Saving settings...'
              : isDirty
                ? 'You have unsaved changes.'
                : 'Settings are up to date.'}
          </p>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isDirty || update.isPending}
                onClick={() => {
                  reset(toFormValues(config))
                  update.reset()
                }}
                className="h-8 cursor-pointer text-xs"
              >
                Discard changes
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!isDirty || update.isPending}
                className="h-8 cursor-pointer gap-1.5 text-xs"
              >
                {update.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save changes</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Discreet Collapsible Audit Metadata */}
      <details className="border-t border-border/50 px-4 py-2.5 text-xs sm:px-5">
        <summary className="cursor-pointer select-none text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          Configuration details
        </summary>
        <dl className="mt-3 grid gap-3 pb-1 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Configuration ID', config.id],
            ['Tenant ID', config.tenantId],
            ['Created at', new Date(config.createdAt).toLocaleString()],
            ['Updated at', new Date(config.updatedAt).toLocaleString()],
            ['Created by', config.createdBy ?? 'Not recorded'],
            ['Updated by', config.updatedBy ?? 'Not recorded'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-mono text-foreground break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </form>
  )
}

function TenantSettingsWorkspace({
  tenantId,
  isAdmin,
}: {
  tenantId: number | string
  isAdmin: boolean
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const initialUrlSection = useMemo(() => readInitialSectionFromLocation(), [])

  const [desktopSection, setDesktopSection] = useState<SettingsSectionId>(
    initialUrlSection ?? 'financial',
  )
  // On mobile (< 768px), `null` renders the native iOS/Android-style settings hub list
  const [mobileSection, setMobileSection] = useState<SettingsSectionId | null>(
    initialUrlSection,
  )

  const configQuery = useConfiguration(tenantId)
  const methodsQuery = usePaymentMethods(true)

  const groupedSections = useMemo(() => groupSettingsSections(), [])
  const activeSection: SettingsSectionId = isDesktop
    ? desktopSection
    : (mobileSection ?? 'financial')

  const selectSection = (id: SettingsSectionId) => {
    setDesktopSection(id)
    setMobileSection(id)
  }

  // Concise live value summaries shown in the mobile menu rows
  const sectionSummaries = useMemo<Partial<Record<SettingsSectionId, string>>>(() => {
    const cfg = configQuery.data
    const activeMethods = methodsQuery.data?.filter((m) => m.active) ?? []
    const defaultMethod = activeMethods.find((m) => m.isDefault)

    return {
      financial: cfg
        ? `${cfg.currency} · ${cfg.decimalPlaces} ${cfg.decimalPlaces === 1 ? 'decimal' : 'decimals'}`
        : undefined,
      regional: cfg
        ? `${LANGUAGE_NAMES[cfg.language]} · ${cfg.timezone} · ${cfg.timeFormat === 'FORMAT_24H' ? '24h' : '12h'}`
        : undefined,
      alerts: cfg ? `${cfg.budgetAlertThreshold}% budget alert` : undefined,
      'payment-methods': methodsQuery.data
        ? `${activeMethods.length} active${defaultMethod ? ` · ${defaultMethod.name}` : ''}`
        : undefined,
    }
  }, [configQuery.data, methodsQuery.data])

  const renderConfigArea = (section: Exclude<SettingsSectionId, 'payment-methods'>) => {
    if (configQuery.isPending) {
      return (
        <div
          role="status"
          className="rounded-xl border border-border/80 bg-card px-5 py-12 text-center text-xs text-muted-foreground shadow-xs"
        >
          Loading workspace settings...
        </div>
      )
    }

    if (configQuery.error) {
      return (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5"
        >
          <p className="text-xs font-medium text-destructive">
            {getApiErrorMessage(configQuery.error)}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={configQuery.isFetching}
            onClick={() => void configQuery.refetch()}
            className="cursor-pointer text-xs"
          >
            Reload settings
          </Button>
        </div>
      )
    }

    if (!configQuery.data) return null

    return (
      <WorkspaceConfigurationForm
        config={configQuery.data}
        tenantId={tenantId}
        isAdmin={isAdmin}
        activeSection={section}
        onSelectSection={selectSection}
      />
    )
  }

  const renderActivePanel = (section: SettingsSectionId) =>
    section === 'payment-methods' ? (
      <PaymentMethodsSettings isAdmin={isAdmin} />
    ) : (
      renderConfigArea(section)
    )

  /* Mobile (< 768px): Native iOS/Android-style Menu List -> Drill-down View */
  if (!isDesktop) {
    if (mobileSection === null) {
      return (
        <div className="space-y-4">
          {groupedSections.map(({ group, items }) => (
            <div key={group} className="space-y-1.5">
              <h2 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h2>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
                {items.map((item) => {
                  const Icon = item.icon
                  const summary = sectionSummaries[item.id] ?? item.description
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSection(item.id)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-foreground">
                            {item.label}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {summary}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMobileSection(null)}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All settings</span>
        </button>
        {renderActivePanel(mobileSection)}
      </div>
    )
  }

  /* Desktop (>= 768px): Left Navigation Rail + Focused Right Content Panel */
  return (
    <div className="grid items-start gap-6 md:grid-cols-[216px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="space-y-4">
        {groupedSections.map(({ group, items }) => (
          <div key={group} className="space-y-1">
            <div className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon
                const isSelected = activeSection === item.id
                const activeCount =
                  item.id === 'payment-methods'
                    ? methodsQuery.data?.filter((m) => m.active).length
                    : undefined

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isSelected ? 'page' : undefined}
                    onClick={() => selectSection(item.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors',
                      isSelected
                        ? 'border border-border/80 bg-card text-foreground shadow-xs font-semibold'
                        : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isSelected ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {activeCount !== undefined && activeCount > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {activeCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="min-w-0 max-w-3xl">
        <div className={activeSection === 'payment-methods' ? 'hidden' : undefined}>
          {renderConfigArea(
            activeSection === 'payment-methods' ? 'financial' : activeSection,
          )}
        </div>
        {activeSection === 'payment-methods' && <PaymentMethodsSettings isAdmin={isAdmin} />}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { activeTenant, isAdmin } = useActiveTenant()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Settings
        </h1>
        {!isAdmin && (
          <Badge variant="secondary" className="shrink-0 font-normal text-muted-foreground">
            View only
          </Badge>
        )}
      </div>

      <TenantSettingsWorkspace
        key={activeTenant.id}
        tenantId={activeTenant.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
