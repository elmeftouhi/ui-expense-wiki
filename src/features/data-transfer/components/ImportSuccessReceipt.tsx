import { ArrowRight, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IMPORT_COUNT_ROWS } from '../utils/backupUtils'
import type { ImportUserDataResponse } from '../types'

interface ImportSuccessReceiptProps {
  result: ImportUserDataResponse
  activeTenantId: number | string
  isSwitchingTenant: boolean
  onSwitchWorkspace: (tenantId: number) => void
  onReset: () => void
}

export function ImportSuccessReceipt({
  result,
  activeTenantId,
  isSwitchingTenant,
  onSwitchWorkspace,
  onReset,
}: ImportSuccessReceiptProps) {
  const isAlreadyActive =
    result.switchedDefaultTenant || String(activeTenantId) === String(result.tenantId)

  const totalImported = IMPORT_COUNT_ROWS.reduce(
    (sum, row) => sum + (result.counts[row.key] ?? 0),
    0,
  )

  return (
    <div
      role="region"
      aria-label="Import summary"
      className="space-y-4 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.04] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Workspace imported
              </h3>
              <Badge
                variant="outline"
                className="border-emerald-500/35 bg-emerald-500/10 font-mono text-[10px] text-emerald-700 dark:text-emerald-300"
              >
                ID #{result.tenantId}
              </Badge>
              {result.switchedDefaultTenant && (
                <Badge variant="secondary" className="text-[10px] font-medium">
                  Default workspace switched
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Created <strong className="font-semibold text-foreground">{result.tenantName}</strong>{' '}
              (workspace ID <span className="font-mono tabular-nums text-foreground">{result.tenantId}</span>) with{' '}
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {totalImported.toLocaleString()}
              </span>{' '}
              imported {totalImported === 1 ? 'record' : 'records'}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {!isAlreadyActive && (
            <Button
              type="button"
              size="sm"
              disabled={isSwitchingTenant}
              onClick={() => onSwitchWorkspace(result.tenantId)}
              className="h-8 cursor-pointer gap-1.5 text-xs"
            >
              {isSwitchingTenant ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Switching...</span>
                </>
              ) : (
                <>
                  <span>Switch to imported workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSwitchingTenant}
            onClick={onReset}
            className="h-8 cursor-pointer gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Import another</span>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" aria-label="Imported record counts">
            <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th scope="col" className="px-3.5 py-2.5">
                  Resource
                </th>
                <th scope="col" className="px-3.5 py-2.5 text-right">
                  Imported count
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {IMPORT_COUNT_ROWS.map(({ key, label }) => {
                const count = result.counts[key] ?? 0
                return (
                  <tr key={key} className="transition-colors hover:bg-muted/20">
                    <td className="px-3.5 py-2 font-medium text-foreground">{label}</td>
                    <td
                      className={cn(
                        'px-3.5 py-2 text-right font-mono tabular-nums',
                        count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {count.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-border/70 bg-muted/25">
              <tr>
                <th scope="row" className="px-3.5 py-2.5 font-semibold text-foreground">
                  Total imported records
                </th>
                <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                  {totalImported.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

