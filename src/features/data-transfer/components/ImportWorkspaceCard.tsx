import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileJson,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { queryKeys } from '@/api/query-keys'
import { ApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
import { SettingsDialog } from '@/features/settings/components/SettingsDialog'
import { cn } from '@/lib/utils'
import { EXPECTED_BACKUP_FORMAT_VERSION } from '../schemas/dataTransferSchema'
import { importDataTransfer } from '../services/dataTransferService'
import type { ImportUserDataRequest, ImportUserDataResponse } from '../types'
import {
  formatByteSize,
  getImportErrorMessage,
  inspectBackupJson,
  readBackupFileAsync,
  type BackupInspectionResult,
} from '../utils/backupUtils'
import { ImportSuccessReceipt } from './ImportSuccessReceipt'

type BackupInputMode = 'file' | 'paste'

const RECENT_IMPORT_STORAGE_KEY = 'expense_wiki_recent_import_receipt'
const RECENT_IMPORT_TTL_MS = 15_000

interface StoredImportReceipt {
  savedAt: number
  result: ImportUserDataResponse
}

function loadRecentImportReceipt(): ImportUserDataResponse | null {
  try {
    const raw = sessionStorage.getItem(RECENT_IMPORT_STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(RECENT_IMPORT_STORAGE_KEY)
    const parsed = JSON.parse(raw) as StoredImportReceipt
    if (
      parsed &&
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt <= RECENT_IMPORT_TTL_MS &&
      parsed.result
    ) {
      return parsed.result
    }
  } catch {
    // ignore storage errors
  }
  return null
}

function saveRecentImportReceipt(result: ImportUserDataResponse): void {
  try {
    const payload: StoredImportReceipt = { savedAt: Date.now(), result }
    sessionStorage.setItem(RECENT_IMPORT_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

interface ImportWorkspaceCardProps {
  activeTenantId: number | string
  isSwitchingTenant: boolean
  onSwitchWorkspace?: (tenantId: number | string) => Promise<void> | void
}

export function ImportWorkspaceCard({
  activeTenantId,
  isSwitchingTenant,
  onSwitchWorkspace,
}: ImportWorkspaceCardProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const tenantNameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputId = useId()
  const pasteInputId = useId()

  const [tenantName, setTenantName] = useState('')
  const [switchDefaultTenant, setSwitchDefaultTenant] = useState(true)
  const [sourceMode, setSourceMode] = useState<BackupInputMode>('file')

  // File upload state (kept separate from textarea so multi-MB files never block DOM layout)
  const [selectedFileMeta, setSelectedFileMeta] = useState<{ name: string; size: number } | null>(
    null,
  )
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [fileInspection, setFileInspection] = useState<BackupInspectionResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Pasted JSON state with debounced background inspection
  const [pastedJson, setPastedJson] = useState('')
  const [debouncedPastedJson, setDebouncedPastedJson] = useState('')

  // Validation & confirmation state
  const [tenantNameError, setTenantNameError] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [pendingPayload, setPendingPayload] = useState<ImportUserDataRequest | null>(null)
  const [importResult, setImportResult] = useState<ImportUserDataResponse | null>(() =>
    loadRecentImportReceipt(),
  )
  const [isManualSwitching, setIsManualSwitching] = useState(false)

  useEffect(() => {
    if (sourceMode !== 'paste' || !pastedJson.trim()) return
    const timer = window.setTimeout(() => {
      setDebouncedPastedJson(pastedJson)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [pastedJson, sourceMode])

  const pasteInspection = useMemo<BackupInspectionResult | null>(() => {
    if (sourceMode !== 'paste' || !debouncedPastedJson.trim()) return null
    return inspectBackupJson(debouncedPastedJson)
  }, [debouncedPastedJson, sourceMode])

  const activeInspection: BackupInspectionResult | null =
    sourceMode === 'file' ? fileInspection : pasteInspection

  const importMutation = useMutation({
    mutationFn: (payload: ImportUserDataRequest) =>
      importDataTransfer(payload, { tenantId: activeTenantId }),
    onSuccess: async (response) => {
      setPendingPayload(null)
      setImportResult(response)
      setTenantName('')
      setSelectedFileMeta(null)
      setFileInspection(null)
      setPastedJson('')
      setDebouncedPastedJson('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      toast.success?.(
        'Workspace imported',
        `Created "${response.tenantName}" (#${response.tenantId}).`,
      )

      await queryClient.invalidateQueries({ queryKey: ['my-tenants'] })
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.myTenants() })

      if (response.switchedDefaultTenant && typeof onSwitchWorkspace === 'function') {
        saveRecentImportReceipt(response)
        try {
          await onSwitchWorkspace(response.tenantId)
          // Clear stored receipt if this component stayed mounted without remounting
          sessionStorage.removeItem(RECENT_IMPORT_STORAGE_KEY)
        } catch {
          sessionStorage.removeItem(RECENT_IMPORT_STORAGE_KEY)
        }
      }
    },
    onError: (error) => {
      setPendingPayload(null)
      const message = getImportErrorMessage(error)
      if (error instanceof ApiClientError && error.status === 409) {
        setTenantNameError(message)
        requestAnimationFrame(() => tenantNameInputRef.current?.focus())
      }
      if (toast.error) {
        toast.error('Import failed', message)
      } else {
        toast.toast?.({ title: 'Import failed', description: message, variant: 'error' })
      }
    },
  })

  const handleFileSelection = async (file: File | null | undefined) => {
    setBackupError(null)
    importMutation.reset()

    if (!file) {
      setSelectedFileMeta(null)
      setFileInspection(null)
      return
    }

    setSelectedFileMeta({ name: file.name, size: file.size })
    setIsReadingFile(true)
    try {
      const content = await readBackupFileAsync(file)
      const inspected = inspectBackupJson(content)
      setFileInspection(inspected)
      if (!inspected.ok) {
        setBackupError(inspected.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to read the selected file.'
      setFileInspection({ ok: false, error: message })
      setBackupError(message)
    } finally {
      setIsReadingFile(false)
    }
  }

  const clearSelectedFile = () => {
    setSelectedFileMeta(null)
    setFileInspection(null)
    setBackupError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePreSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (isReadingFile || importMutation.isPending) return

    importMutation.reset()
    let hasError = false

    const trimmedName = tenantName.trim()
    if (!trimmedName) {
      setTenantNameError('Enter a name for the new workspace.')
      hasError = true
    } else {
      setTenantNameError(null)
    }

    const currentInspection: BackupInspectionResult =
      sourceMode === 'file'
        ? (fileInspection ?? {
            ok: false,
            error: 'Provide a backup JSON file or paste backup JSON.',
          })
        : inspectBackupJson(pastedJson)

    if (!currentInspection.ok) {
      setBackupError(currentInspection.error)
      hasError = true
    } else {
      setBackupError(null)
      if (sourceMode === 'paste') {
        setDebouncedPastedJson(pastedJson)
      }
    }

    if (hasError) {
      if (!trimmedName) {
        tenantNameInputRef.current?.focus()
      }
      return
    }

    if (currentInspection.ok) {
      setPendingPayload({
        tenantName: trimmedName,
        switchDefaultTenant,
        backup: currentInspection.snapshot,
      })
    }
  }

  const handleSwitchToImportedWorkspace = async (tenantId: number) => {
    if (!onSwitchWorkspace) return
    setIsManualSwitching(true)
    try {
      await onSwitchWorkspace(tenantId)
      toast.success?.('Switched workspace', importResult ? `Now viewing ${importResult.tenantName}.` : undefined)
    } catch (error) {
      const message = getImportErrorMessage(error)
      if (toast.error) {
        toast.error('Unable to switch workspace', message)
      } else {
        toast.toast?.({ title: 'Unable to switch workspace', description: message, variant: 'error' })
      }
    } finally {
      setIsManualSwitching(false)
    }
  }

  const formatWarning = activeInspection?.ok ? activeInspection.formatWarning : null
  const isBusy = isReadingFile || importMutation.isPending

  return (
    <section
      aria-labelledby="import-workspace-heading"
      className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs"
    >
      <div className="border-b border-border/60 px-4 py-3.5 sm:px-5 sm:py-4">
        <h3 id="import-workspace-heading" className="text-sm font-semibold text-foreground">
          Import workspace backup
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Restore a backup snapshot into a brand-new workspace with its own isolated ledger.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {importResult && (
          <ImportSuccessReceipt
            result={importResult}
            activeTenantId={activeTenantId}
            isSwitchingTenant={isSwitchingTenant || isManualSwitching}
            onSwitchWorkspace={(id) => void handleSwitchToImportedWorkspace(id)}
            onReset={() => setImportResult(null)}
          />
        )}

        {importMutation.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{getImportErrorMessage(importMutation.error)}</span>
          </div>
        )}

        <form onSubmit={handlePreSubmit} noValidate className="space-y-4">
          <fieldset disabled={importMutation.isPending} className="min-w-0 space-y-4">
            <legend className="sr-only">Import backup parameters</legend>

            {/* Workspace name */}
            <div className="space-y-1.5">
              <label
                htmlFor="import-tenant-name"
                className="block text-xs font-semibold text-foreground"
              >
                New workspace name <span className="text-destructive">*</span>
              </label>
              <input
                ref={tenantNameInputRef}
                id="import-tenant-name"
                type="text"
                value={tenantName}
                onChange={(event) => {
                  setTenantName(event.target.value)
                  if (tenantNameError) setTenantNameError(null)
                }}
                placeholder="e.g. My restored workspace"
                aria-invalid={Boolean(tenantNameError)}
                aria-describedby={tenantNameError ? 'import-tenant-name-error' : undefined}
                className={cn(fieldInputClass, tenantNameError && fieldInvalidClass)}
              />
              {tenantNameError && (
                <p
                  id="import-tenant-name-error"
                  role="alert"
                  className="flex items-center gap-1 text-[11px] font-medium text-destructive"
                >
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{tenantNameError}</span>
                </p>
              )}
            </div>

            {/* Switch default tenant checkbox */}
            <label
              htmlFor="import-switch-default-tenant"
              className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3.5 py-2.5 transition-colors hover:bg-muted/35"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">
                  Set as default workspace
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  Automatically switch your default and active workspace after import completes.
                </span>
              </span>
              <input
                id="import-switch-default-tenant"
                type="checkbox"
                checked={switchDefaultTenant}
                onChange={(event) => setSwitchDefaultTenant(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
              />
            </label>

            {/* Backup source mode toggle */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Backup JSON source <span className="text-destructive">*</span>
                </span>
                <div
                  role="radiogroup"
                  aria-label="Backup JSON source method"
                  className="inline-grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/50 p-0.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={sourceMode === 'file'}
                    onClick={() => {
                      setSourceMode('file')
                      setBackupError(null)
                    }}
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors',
                      sourceMode === 'file'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload file</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={sourceMode === 'paste'}
                    onClick={() => {
                      setSourceMode('paste')
                      setBackupError(null)
                    }}
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors',
                      sourceMode === 'paste'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <ClipboardPaste className="h-3 w-3" />
                    <span>Paste JSON</span>
                  </button>
                </div>
              </div>

              {sourceMode === 'file' ? (
                <div className="space-y-2">
                  <div
                    onDragOver={(event) => {
                      event.preventDefault()
                      setIsDragOver(true)
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setIsDragOver(false)
                      const droppedFile = event.dataTransfer.files?.[0]
                      if (droppedFile) void handleFileSelection(droppedFile)
                    }}
                    className={cn(
                      'relative rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
                      isDragOver
                        ? 'border-primary bg-primary/5'
                        : backupError
                          ? 'border-destructive/60 bg-destructive/[0.03]'
                          : 'border-border/80 bg-muted/15 hover:bg-muted/30',
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      id={fileInputId}
                      type="file"
                      accept=".json,application/json"
                      aria-label="Backup JSON file"
                      aria-invalid={Boolean(backupError)}
                      onChange={(event) => {
                        const chosen = event.target.files?.[0]
                        void handleFileSelection(chosen)
                      }}
                      className="sr-only"
                    />

                    {isReadingFile ? (
                      <div
                        role="status"
                        className="flex flex-col items-center justify-center gap-2 py-1 text-xs text-muted-foreground"
                      >
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Reading backup file...</span>
                      </div>
                    ) : selectedFileMeta ? (
                      <div className="flex flex-col items-center justify-between gap-3 text-left sm:flex-row">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-primary">
                            <FileJson className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-semibold text-foreground">
                              {selectedFileMeta.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatByteSize(selectedFileMeta.size)}
                              {fileInspection?.ok && (
                                <>
                                  {' · '}
                                  <span className="font-mono tabular-nums">
                                    {fileInspection.estimatedRecords.toLocaleString()}
                                  </span>{' '}
                                  {fileInspection.estimatedRecords === 1 ? 'record' : 'records'}
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={fileInputId}
                            className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            Replace file
                          </label>
                          <button
                            type="button"
                            onClick={clearSelectedFile}
                            aria-label="Remove selected backup file"
                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground">
                          <label
                            htmlFor={fileInputId}
                            className="cursor-pointer font-semibold text-primary hover:underline"
                          >
                            Choose a .json backup file
                          </label>{' '}
                          or drag and drop it here
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Expected snapshot format version:{' '}
                          <span className="font-mono">{EXPECTED_BACKUP_FORMAT_VERSION}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor={pasteInputId} className="sr-only">
                    Backup JSON
                  </label>
                  <textarea
                    id={pasteInputId}
                    rows={9}
                    spellCheck={false}
                    value={pastedJson}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setPastedJson(nextValue)
                      if (!nextValue.trim()) setDebouncedPastedJson('')
                      if (backupError) setBackupError(null)
                    }}
                    placeholder={`{\n  "metadata": {\n    "formatVersion": "${EXPECTED_BACKUP_FORMAT_VERSION}"\n  }\n}`}
                    aria-label="Backup JSON"
                    aria-invalid={Boolean(backupError)}
                    className={cn(
                      'custom-scrollbar w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60',
                      backupError && fieldInvalidClass,
                    )}
                  />
                </div>
              )}

              {/* Validation error for JSON */}
              {backupError && (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-destructive"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{backupError}</span>
                </p>
              )}

              {/* Snapshot format verification or warning */}
              {!backupError && activeInspection?.ok && (
                formatWarning ? (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{formatWarning}</span>
                  </div>
                ) : (
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Valid backup JSON verified (format version{' '}
                      <span className="font-mono font-semibold">
                        {activeInspection.formatVersion}
                      </span>
                      {activeInspection.sourceTenantName
                        ? `, exported from "${activeInspection.sourceTenantName}"`
                        : ''}
                      ).
                    </span>
                  </p>
                )
              )}
            </div>
          </fieldset>

          <div className="flex items-center justify-end border-t border-border/60 pt-3.5">
            <Button
              type="submit"
              size="sm"
              disabled={isBusy}
              className="h-8 cursor-pointer gap-1.5 text-xs"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import workspace backup</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Confirmation modal before import */}
      {pendingPayload && (
        <SettingsDialog
          title="Confirm workspace import"
          description="Review the target workspace details before restoring this backup."
          onClose={() => {
            if (!importMutation.isPending) setPendingPayload(null)
          }}
          dismissible={!importMutation.isPending}
        >
          <div className="space-y-3.5 text-xs">
            <p className="leading-relaxed text-muted-foreground">
              Import creates a new workspace and does not overwrite existing workspace data.
            </p>

            <dl className="divide-y divide-border/60 rounded-lg border border-border/80 bg-muted/20">
              <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                <dt className="text-muted-foreground">New workspace name</dt>
                <dd className="truncate font-semibold text-foreground">
                  {pendingPayload.tenantName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                <dt className="text-muted-foreground">Switch default workspace</dt>
                <dd className="font-medium text-foreground">
                  {pendingPayload.switchDefaultTenant
                    ? 'Yes — set as default workspace'
                    : 'No — keep current default'}
                </dd>
              </div>
            </dl>

            {formatWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{formatWarning}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={importMutation.isPending}
                onClick={() => setPendingPayload(null)}
                className="cursor-pointer text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate(pendingPayload)}
                className="min-w-[128px] cursor-pointer gap-1.5 text-xs"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Confirm import</span>
                )}
              </Button>
            </div>
          </div>
        </SettingsDialog>
      )}
    </section>
  )
}

