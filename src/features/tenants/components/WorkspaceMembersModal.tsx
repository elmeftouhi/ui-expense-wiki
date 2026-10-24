import React, { useState } from 'react'
import {
  Users,
  UserPlus,
  Trash2,
  X,
  Check,
  Copy,
  AlertCircle,
  Clock,
  Shield,
  CheckCircle2,
  Mail,
  KeyRound,
  User,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tenant, TenantRole, TenantUser, TenantInviteResponse } from '../types'
import { tenantService } from '../services/tenantService'
import { useAuth } from '@/features/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface WorkspaceMembersModalProps {
  tenant: Tenant
  isOpen: boolean
  onClose: () => void
  onMembersCountChange?: (tenantId: number | string, newCount: number) => void
}

export const WorkspaceMembersModal: React.FC<WorkspaceMembersModalProps> = ({
  tenant,
  isOpen,
  onClose,
  onMembersCountChange,
}) => {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'INVITE' | 'DIRECT_ADD'>('MEMBERS')
  const [inviteRole, setInviteRole] = useState<TenantRole>('EDITOR')
  const [inviteHours, setInviteHours] = useState<number>(72)
  const [inviteEmail, setInviteEmail] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<TenantInviteResponse | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Direct add user form state
  const [directEmail, setDirectEmail] = useState('')
  const [directPassword, setDirectPassword] = useState('')
  const [directFirstName, setDirectFirstName] = useState('')
  const [directLastName, setDirectLastName] = useState('')
  const [directRole, setDirectRole] = useState<TenantRole>('EDITOR')
  const [memberToRemove, setMemberToRemove] = useState<TenantUser | null>(null)

  // Fetch users for this tenant
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['tenant-users', tenant.id],
    queryFn: async () => {
      try {
        const fetched = await tenantService.getTenantUsers(tenant.id)
        if (Array.isArray(fetched)) {
          if (onMembersCountChange) {
            onMembersCountChange(tenant.id, fetched.length)
          }
          return fetched
        }
        return []
      } catch {
        // Fallback demo user if backend endpoint is unavailable
        const fallback: TenantUser[] = [
          {
            id: currentUser?.id || 1,
            email: currentUser?.email || 'admin@acme.com',
            displayedName: currentUser?.firstName
              ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
              : 'Workspace Administrator',
            firstName: currentUser?.firstName || 'Workspace',
            lastName: currentUser?.lastName || 'Admin',
            status: 'ACTIVE',
            role: 'ADMIN',
          },
        ]
        if (onMembersCountChange) {
          onMembersCountChange(tenant.id, fallback.length)
        }
        return fallback
      }
    },
    enabled: isOpen,
    staleTime: 1000 * 30,
  })

  // Mutation to create invitation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      return tenantService.createTenantInvite({
        tenantId: tenant.id,
        role: inviteRole,
        expiresInHours: inviteHours,
        email: inviteEmail.trim() || undefined,
      })
    },
    onSuccess: (data) => {
      setGeneratedInvite(data)
      setNotice(`Invitation created for ${data.role} role.`)
      setTimeout(() => setNotice(null), 4000)
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to create invite.')
    },
  })

  // Mutation to remove a member
  const removeMutation = useMutation({
    mutationFn: async (memberId: number | string) => {
      setError(null)
      await tenantService.removeTenantMember(tenant.id, memberId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users', tenant.id] })
      refetch()
      const newCount = Math.max(1, users.length - 1)
      if (onMembersCountChange) {
        onMembersCountChange(tenant.id, newCount)
      }
      setNotice(
        memberToRemove
          ? `Removed ${memberToRemove.displayedName || memberToRemove.email} from workspace.`
          : 'Member removed successfully.',
      )
      setMemberToRemove(null)
      setTimeout(() => setNotice(null), 4000)
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to remove member.')
      setMemberToRemove(null)
    },
  })

  // Mutation to directly add a user
  const directAddMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!directEmail.trim() || !directPassword) {
        throw new Error('Email and password are required.')
      }
      const numericTenantId =
        typeof tenant.id === 'number' ? tenant.id : parseInt(String(tenant.id), 10) || 1
      return tenantService.directAddUser({
        email: directEmail.trim(),
        password: directPassword,
        firstName: directFirstName.trim() || undefined,
        lastName: directLastName.trim() || undefined,
        tenantAssignments: [
          {
            tenantId: numericTenantId,
            role: directRole,
          },
        ],
      })
    },
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users', tenant.id] })
      refetch()
      if (onMembersCountChange) {
        onMembersCountChange(tenant.id, users.length + 1)
      }
      setNotice(`User ${newUser.email} added to workspace.`)
      setDirectEmail('')
      setDirectPassword('')
      setDirectFirstName('')
      setDirectLastName('')
      setActiveTab('MEMBERS')
      setTimeout(() => setNotice(null), 4000)
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to add user.')
    },
  })

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    } catch {
      // ignore
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-50">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">{tenant.name}</h2>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {users.length} {users.length === 1 ? 'member' : 'members'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage workspace members, invite collaborators, and assign roles.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notices & Errors */}
        {notice && (
          <div className="mx-6 mt-4 flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium animate-in fade-in-50">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 border-b border-border/40 bg-muted/20 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('MEMBERS')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                activeTab === 'MEMBERS'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Members ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('INVITE')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                activeTab === 'INVITE'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Invite Code
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DIRECT_ADD')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                activeTab === 'DIRECT_ADD'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Add User
            </button>
          </div>

          {activeTab === 'MEMBERS' && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setActiveTab('INVITE')}
              className="h-7 text-xs gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite</span>
            </Button>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: MEMBERS LIST */}
          {activeTab === 'MEMBERS' && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading workspace members...
                </div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-xs text-muted-foreground">No members found in this workspace.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50 rounded-xl border border-border/60 overflow-hidden">
                  {users.map((member) => {
                    const isSelf =
                      String(member.id) === String(currentUser?.id) ||
                      member.email === currentUser?.email
                    const membership = member.tenantMemberships?.find(
                      (m) => String(m.id) === String(tenant.id),
                    )
                    const role = member.role || membership?.role || 'ADMIN'
                    const displayName =
                      member.displayedName ||
                      `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
                      member.email

                    return (
                      <div
                        key={member.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {displayName}
                              </span>
                              {isSelf && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  You
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <Badge
                            variant={
                              role === 'ADMIN'
                                ? 'default'
                                : role === 'EDITOR'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px]"
                          >
                            <Shield className="w-2.5 h-2.5 mr-1" />
                            {role}
                          </Badge>

                          <button
                            type="button"
                            title={isSelf ? 'Cannot remove yourself' : 'Remove member'}
                            disabled={isSelf || removeMutation.isPending}
                            onClick={() => setMemberToRemove(member)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSelf
                                ? 'text-muted-foreground/40 cursor-not-allowed'
                                : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVITE CODE GENERATOR */}
          {activeTab === 'INVITE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <span>Generate Invitation Code</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Create a secure, time-limited invitation code that collaborators can use to join{' '}
                  <strong className="text-foreground">{tenant.name}</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">Assigned Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as TenantRole)}
                      className="w-full h-8 px-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="VIEWER">VIEWER (Read-only)</option>
                      <option value="EDITOR">EDITOR (Manage records)</option>
                      <option value="ADMIN">ADMIN (Full management)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">Expiration</label>
                    <select
                      value={inviteHours}
                      onChange={(e) => setInviteHours(Number(e.target.value))}
                      className="w-full h-8 px-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value={24}>24 Hours</option>
                      <option value={72}>3 Days (72 Hours)</option>
                      <option value={168}>7 Days (168 Hours)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    Optional Recipient Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={inviteMutation.isPending}
                    onClick={() => inviteMutation.mutate()}
                    className="h-8 text-xs cursor-pointer gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{inviteMutation.isPending ? 'Generating...' : 'Create Invite Code'}</span>
                  </Button>
                </div>
              </div>

              {/* Display Generated Invite */}
              {generatedInvite && (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Active Invitation Code
                    </span>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Clock className="w-3 h-3" />
                      Expires: {new Date(generatedInvite.expiresAt).toLocaleDateString()}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border">
                    <code className="flex-1 font-mono text-sm font-bold tracking-wider text-foreground select-all">
                      {generatedInvite.inviteCode}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCopyCode(generatedInvite.inviteCode)}
                      className="h-7 text-xs gap-1 cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT USER PROVISIONING */}
          {activeTab === 'DIRECT_ADD' && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                directAddMutation.mutate()
              }}
              className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <User className="w-4 h-4 text-primary" />
                <span>Direct User Provisioning</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Instantly create a new user account attached to{' '}
                <strong className="text-foreground">{tenant.name}</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">First Name</label>
                  <input
                    type="text"
                    value={directFirstName}
                    onChange={(e) => setDirectFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full h-8 px-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Last Name</label>
                  <input
                    type="text"
                    value={directLastName}
                    onChange={(e) => setDirectLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full h-8 px-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={directEmail}
                    onChange={(e) => setDirectEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full h-8 px-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={directPassword}
                    onChange={(e) => setDirectPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full h-8 px-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <label className="font-semibold text-foreground">Assigned Role</label>
                <select
                  value={directRole}
                  onChange={(e) => setDirectRole(e.target.value as TenantRole)}
                  className="w-full h-8 px-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="VIEWER">VIEWER</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('MEMBERS')}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={directAddMutation.isPending}
                  className="h-8 text-xs cursor-pointer min-w-[100px]"
                >
                  {directAddMutation.isPending ? 'Adding...' : 'Add User'}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Confirmation Modal to Remove Member */}
        {memberToRemove && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-50">
            <div className="w-full max-w-sm rounded-xl border border-destructive/30 bg-card p-5 shadow-2xl space-y-3">
              <div className="flex items-center gap-2 text-destructive text-sm font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>Remove Member</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to remove{' '}
                <strong className="text-foreground">
                  {memberToRemove.displayedName || memberToRemove.email}
                </strong>{' '}
                from <strong className="text-foreground">{tenant.name}</strong>? They will immediately
                lose access to this workspace.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMemberToRemove(null)}
                  className="h-7 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(memberToRemove.id)}
                  className="h-7 text-xs cursor-pointer"
                >
                  {removeMutation.isPending ? 'Removing...' : 'Confirm Remove'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border/60 flex items-center justify-end bg-muted/10">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="h-8 text-xs cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
