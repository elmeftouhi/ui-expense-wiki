import React, { useState } from 'react'
import {
  Building2,
  Plus,
  ArrowRight,
  X,
  AlertCircle,
  CheckCircle2,
  Check,
  LayoutList,
  LayoutGrid,
  Users,
  UserPlus,
} from 'lucide-react'
import { useActiveTenant } from '../context/useActiveTenant'
import { tenantService } from '../services/tenantService'
import { useAuth } from '@/features/auth'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WorkspaceMembersModal } from '../components/WorkspaceMembersModal'
import type { Tenant } from '../types'

export const TenantManagementPage: React.FC = () => {
  const { activeTenant, availableTenants, memberships, switchTenant, isSwitching } =
    useActiveTenant()
  const { setSessionFromAuth } = useAuth()
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Members modal state
  const [membersModalTenant, setMembersModalTenant] = useState<Tenant | null>(null)
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})

  // Fetch live active tenant users to get real-time count
  const { data: activeTenantUsers = [] } = useQuery({
    queryKey: ['tenant-users', activeTenant.id],
    queryFn: async () => {
      try {
        const res = await tenantService.getTenantUsers(activeTenant.id)
        return Array.isArray(res) ? res : []
      } catch {
        return []
      }
    },
    staleTime: 1000 * 30,
  })

  const getMemberCount = (tenantId: number | string) => {
    const key = String(tenantId)
    if (memberCounts[key] !== undefined) {
      return memberCounts[key]
    }
    if (key === String(activeTenant.id) && activeTenantUsers.length > 0) {
      return activeTenantUsers.length
    }
    return 1
  }

  const handleMemberCountChange = (tenantId: number | string, newCount: number) => {
    setMemberCounts((prev) => ({
      ...prev,
      [String(tenantId)]: newCount,
    }))
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newTenantName.trim() || newTenantName.trim().length < 3) {
      setError('Workspace name must be at least 3 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await tenantService.createTenant(newTenantName.trim())
      setSessionFromAuth(response)
      await queryClient.invalidateQueries({ queryKey: ['my-tenants'] })
      queryClient.removeQueries()
      setIsCreateModalOpen(false)
      setNewTenantName('')
      setNotice(`Workspace "${newTenantName.trim()}" created successfully.`)
      setTimeout(() => setNotice(null), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium animate-in fade-in-50"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header with Title, View Mode Switch, and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Workspaces
            </h1>
            <p className="text-xs text-muted-foreground">
              {availableTenants.length} {availableTenants.length === 1 ? 'workspace' : 'workspaces'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* List vs Grid Switch */}
          <div className="flex items-center p-0.5 rounded-lg border border-input bg-muted/40 text-xs">
            <button
              id="view-mode-list-btn"
              type="button"
              onClick={() => setViewMode('LIST')}
              title="List View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'LIST'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              id="view-mode-grid-btn"
              type="button"
              onClick={() => setViewMode('GRID')}
              title="Grid View"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 cursor-pointer text-xs h-8"
          >
            <Plus className="w-4 h-4" />
            <span>New Workspace</span>
          </Button>
        </div>
      </div>

      {/* Main Content: List or Grid */}
      {viewMode === 'LIST' ? (
        <Card className="overflow-hidden border border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Users</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {availableTenants.map((t) => {
                    const membership = memberships.find((m) => String(m.tenantId) === String(t.id))
                    const isCurrent = String(t.id) === String(activeTenant.id)
                    const count = getMemberCount(t.id)

                    return (
                      <tr
                        key={t.id}
                        className={
                          isCurrent
                            ? 'bg-primary/10 border-l-4 border-l-primary font-medium'
                            : 'hover:bg-muted/30 transition-colors border-l-4 border-l-transparent'
                        }
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isCurrent
                                  ? 'bg-primary text-primary-foreground shadow-xs'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm">
                                {t.name}
                              </span>
                              {isCurrent && (
                                <Badge variant="default" className="text-[10px] px-2 py-0.5 gap-1 shadow-xs">
                                  <Check className="w-3 h-3" /> Active
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs">{t.currency}</td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              membership?.role === 'ADMIN'
                                ? 'default'
                                : membership?.role === 'EDITOR'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px]"
                          >
                            {membership?.role || 'ADMIN'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setMembersModalTenant(t)}
                            title="Manage workspace members"
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 hover:bg-muted text-foreground text-xs font-medium cursor-pointer transition-colors"
                          >
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-semibold">{count}</span>
                            <span className="text-muted-foreground text-[11px]">
                              {count === 1 ? 'user' : 'users'}
                            </span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0 text-emerald-600 border-emerald-500/30"
                          >
                            {t.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setMembersModalTenant(t)}
                              className="h-7 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>Members</span>
                            </Button>

                            {isCurrent ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary px-2">
                                <CheckCircle2 className="w-4 h-4" /> Selected
                              </span>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={isSwitching}
                                onClick={() => switchTenant(t.id)}
                                className="h-7 text-xs gap-1.5 cursor-pointer"
                              >
                                <span>Switch</span>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Grid Display */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableTenants.map((t) => {
            const membership = memberships.find((m) => String(m.tenantId) === String(t.id))
            const isCurrent = String(t.id) === String(activeTenant.id)
            const count = getMemberCount(t.id)

            return (
              <Card
                key={t.id}
                className={`relative transition-all duration-200 overflow-hidden ${
                  isCurrent
                    ? 'border-2 border-primary bg-primary/[0.04] shadow-md ring-2 ring-primary/20'
                    : 'hover:border-border/80 hover:shadow-sm'
                }`}
              >
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                )}
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate">
                          {t.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={
                              membership?.role === 'ADMIN'
                                ? 'default'
                                : membership?.role === 'EDITOR'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px]"
                          >
                            {membership?.role || 'ADMIN'}
                          </Badge>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {t.currency}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isCurrent ? (
                      <Badge variant="default" className="text-[10px] px-2 py-0.5 gap-1 shrink-0 shadow-xs">
                        <Check className="w-3 h-3" /> Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0 text-emerald-600 border-emerald-500/30 shrink-0"
                      >
                        {t.status}
                      </Badge>
                    )}
                  </div>

                  {/* Users stats row */}
                  <div className="flex items-center justify-between text-xs pt-1 px-1">
                    <button
                      type="button"
                      onClick={() => setMembersModalTenant(t)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-semibold text-foreground">{count}</span>
                      <span>{count === 1 ? 'member' : 'members'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMembersModalTenant(t)}
                      className="text-[11px] font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Manage</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-border/40">
                    {isCurrent ? (
                      <div className="w-full py-1.5 px-3 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Selected Workspace</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSwitching}
                        onClick={() => switchTenant(t.id)}
                        className="w-full text-xs gap-1.5 cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors h-8"
                      >
                        <span>Switch to workspace</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Workspace Members Management Modal */}
      {membersModalTenant && (
        <WorkspaceMembersModal
          tenant={membersModalTenant}
          isOpen={!!membersModalTenant}
          onClose={() => setMembersModalTenant(null)}
          onMembersCountChange={handleMemberCountChange}
        />
      )}

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Create New Workspace</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Provision a new organization on your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Organization Name</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="e.g. Acme Labs or Nexus Digital"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="cursor-pointer min-w-[120px]"
                >
                  {isSubmitting ? 'Creating...' : 'Create Workspace'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
