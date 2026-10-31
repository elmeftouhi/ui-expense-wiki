import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Download, FileJson, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { exportDataTransfer } from '../services/dataTransferService'
import {
  buildBackupFilename,
  downloadBackupJson,
  getExportErrorMessage,
  sanitizeTenantNameForFilename,
} from '../utils/backupUtils'

interface ExportWorkspaceCardProps {
  tenantId: number | string
  tenantName: string
  isAdmin: boolean
}

export function ExportWorkspaceCard({
  tenantId,
  tenantName,
  isAdmin,
}: ExportWorkspaceCardProps) {
  const toast = useToast()
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null)

  const exportMutation = useMutation({
    mutationFn: () => exportDataTransfer({ tenantId }),
    onSuccess: (snapshot) => {
      const filename = buildBackupFilename(tenantName, new Date())
      downloadBackupJson(snapshot, filename)
      setLastExportedFilename(filename)
      toast.success?.('Workspace backup exported', `Downloaded ${filename}`)
    },
    onError: (error) => {
      const message = getExportErrorMessage(error)
      if (toast.error) {
        toast.error('Export failed', message)
      } else {
        toast.toast?.({ title: 'Export failed', description: message, variant: 'error' })
      }
    },
  })

  const previewSlug = sanitizeTenantNameForFilename(tenantName)

  return (
    <section
      aria-labelledby="export-workspace-heading"
      className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs"
    >
      <div className="border-b border-border/60 px-4 py-3.5 sm:px-5 sm:py-4">
        <h3 id="export-workspace-heading" className="text-sm font-semibold text-foreground">
          Export workspace backup
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Download a complete JSON snapshot of <strong className="font-medium text-foreground">{tenantName}</strong>, including configuration, categories, payment methods, budgets, subscriptions, and expenses.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>Tenant administrator access is required to export workspace data.</span>
        </div>
      )}

      <div className="space-y-3.5 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-primary">
              <FileJson className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Archive filename pattern</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                expense-backup-{previewSlug}-yyyyMMdd-HHmmss.json
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={!isAdmin || exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
            className="h-8 shrink-0 cursor-pointer gap-1.5 text-xs"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Export current workspace data</span>
              </>
            )}
          </Button>
        </div>

        {lastExportedFilename && !exportMutation.error && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              Downloaded <span className="font-mono">{lastExportedFilename}</span>
            </span>
          </p>
        )}

        {exportMutation.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{getExportErrorMessage(exportMutation.error)}</span>
          </div>
        )}
      </div>
    </section>
  )
}

