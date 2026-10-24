import type { Tenant, TenantMembership } from '../types'

/**
 * Clearly labeled mock tenants for frontend scaffolding, development, and tenant switching demonstration.
 * In production API integration, these will be populated from /v1/me/tenants.
 */
export const DEMO_TENANTS: Tenant[] = [
  {
    id: 101,
    name: 'Acme Corporation [DEMO]',
    slug: 'acme-corp',
    currency: 'USD',
    locale: 'en-US',
    status: 'ACTIVE',
    plan: 'PRO',
    fiscalYearStartMonth: 1,
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 102,
    name: 'Nexus Global Labs [DEMO]',
    slug: 'nexus-labs',
    currency: 'EUR',
    locale: 'de-DE',
    status: 'ACTIVE',
    plan: 'ENTERPRISE',
    fiscalYearStartMonth: 4, // April fiscal year
    createdAt: '2023-11-20T10:30:00Z',
  },
  {
    id: 103,
    name: 'Nordic Studio [DEMO]',
    slug: 'nordic-studio',
    currency: 'SEK',
    locale: 'sv-SE',
    status: 'ACTIVE',
    plan: 'FREE',
    fiscalYearStartMonth: 1,
    createdAt: '2024-05-01T14:15:00Z',
  },
]

export const DEMO_MEMBERSHIPS: TenantMembership[] = [
  {
    id: 1,
    tenantId: 101,
    tenantName: 'Acme Corporation [DEMO]',
    role: 'ADMIN',
    isDefault: true,
  },
  {
    id: 2,
    tenantId: 102,
    tenantName: 'Nexus Global Labs [DEMO]',
    role: 'EDITOR',
    isDefault: false,
  },
  {
    id: 3,
    tenantId: 103,
    tenantName: 'Nordic Studio [DEMO]',
    role: 'VIEWER',
    isDefault: false,
  },
]
