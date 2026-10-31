import { Info } from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { ExportWorkspaceCard } from './ExportWorkspaceCard'
import { ImportWorkspaceCard } from './ImportWorkspaceCard'

interface DataTransferSettingsProps {
  isAdmin?: boolean
}

export function DataTransferSettings({ isAdmin: isAdminProp }: DataTransferSettingsProps) {
  const tenantContext = useActiveTenant()
  const activeTenant = tenantContext.activeTenant
  const isAdmin = isAdminProp ?? tenantContext.isAdmin
  const isSwitching = tenantContext.isSwitching ?? false
  const switchTenant = tenantContext.switchTenant

  return (
    <div className="space-y-4" aria-labelledby="data-transfer-heading">
      <div className="rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-xs sm:px-5 sm:py-4">
        <h2 id="data-transfer-heading" className="text-sm font-semibold text-foreground">
          Data Transfer
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Back up your current workspace to a portable JSON file or restore a backup into a new workspace.
        </p>

        <div
          role="note"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Import creates a new workspace and does not overwrite existing workspace data.</span>
        </div>
      </div>

      <ExportWorkspaceCard
        key={String(activeTenant.id)}
        tenantId={activeTenant.id}
        tenantName={activeTenant.name}
        isAdmin={isAdmin}
      />

      <ImportWorkspaceCard
        activeTenantId={activeTenant.id}
        isSwitchingTenant={isSwitching}
        onSwitchWorkspace={switchTenant}
      />
    </div>
  )
}
