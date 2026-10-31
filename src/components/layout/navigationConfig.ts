import type { ComponentType } from 'react'
import {
  Building2,
  CalendarClock,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  ScanLine,
  Settings,
  Tags,
} from 'lucide-react'

export interface AppNavItem {
  name: string
  to: string
  icon: ComponentType<{ className?: string }>
  adminOnly?: boolean
}

export const PRIMARY_NAV_ITEMS: AppNavItem[] = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
  { name: 'Budgets', to: '/budgets', icon: PiggyBank },
  { name: 'Subscriptions', to: '/subscriptions', icon: CalendarClock },
  { name: 'Categories', to: '/categories', icon: Tags },
  { name: 'Receipts', to: '/receipts', icon: ScanLine },
]

export const WORKSPACE_NAV_ITEMS: AppNavItem[] = [
  { name: 'Workspaces', to: '/tenants', icon: Building2, adminOnly: true },
  { name: 'Settings', to: '/settings', icon: Settings },
]

