import { z } from 'zod'
import { apiClient } from '@/api/client'
import { filterPage } from '@/features/payment-methods/filterPaymentMethodPage'
import { calculateRecurringCosts } from '../utils/recurringCosts'
import {
  backfillPaymentResponseSchema,
  generatePaymentResponseSchema,
  subscriptionPaymentPageResponseSchema,
  subscriptionPaymentResponseSchema,
  subscriptionResponseSchema,
  subscriptionPageResponseSchema,
} from '../schemas/subscriptionResponseSchema'
import type {
  BackfillSubscriptionPaymentRequest,
  BackfillSubscriptionPaymentResult,
  Subscription,
  SubscriptionRecurringCost,
  SubscriptionCostFilters,
  SubscriptionFilters,
  SubscriptionPayment,
  SubscriptionPaymentPage,
  GeneratePaymentResult,
  SubscriptionPage,
  SubscriptionPageParams,
  SubscriptionResumeRequest,
  SubscriptionWriteRequest,
} from '../types'

const BASE = '/v1/subscriptions'

function parseResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error('The server returned invalid subscription data. Refresh the page or contact support.')
  }
  return result.data
}

export function buildDateOnlyQueryParams(filters: SubscriptionFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: filters.page,
    size: filters.size,
    sort: `${filters.sort},${filters.direction}`,
  }
  if (filters.search?.trim()) params.search = filters.search.trim()
  if (filters.status) params.status = filters.status
  if (filters.categoryIds?.length) params.categoryIds = filters.categoryIds.join(',')
  else if (filters.categoryId) params.categoryId = filters.categoryId
  if (filters.frequency) params.frequency = filters.frequency
  if (filters.nextBillingFrom) params.nextBillingFrom = filters.nextBillingFrom
  if (filters.nextBillingTo) params.nextBillingTo = filters.nextBillingTo
  return params
}

async function parseLifecycleResult(id: number, raw: unknown): Promise<Subscription> {
  return raw === undefined || raw === null
    ? subscriptionService.getById(id)
    : parseResponse(subscriptionResponseSchema, raw)
}

export const subscriptionService = {
  async recurringCosts(filters: SubscriptionCostFilters = {}): Promise<SubscriptionRecurringCost[]> {
    if (filters.paymentMethodId !== undefined || filters.paymentMethodIds?.length || (filters.statuses?.length ?? 0) > 1) {
      const matches = await subscriptionService.list({
        ...filters, page: 0, size: Number.MAX_SAFE_INTEGER, sort: 'name', direction: 'asc',
      })
      return calculateRecurringCosts(matches.content)
    }
    const subscriptions: Subscription[] = []
    let page = 0
    let totalPages = 1
    while (page < totalPages) {
      const result = await subscriptionService.list({
        ...filters, page, size: 100, sort: 'name', direction: 'asc',
      })
      subscriptions.push(...result.content)
      totalPages = result.totalPages
      page += 1
    }
    return calculateRecurringCosts(subscriptions)
  },

  async list(filters: SubscriptionFilters): Promise<SubscriptionPage> {
    const methodIds = filters.paymentMethodIds?.length ? filters.paymentMethodIds
      : filters.paymentMethodId !== undefined ? [filters.paymentMethodId] : []
    const statuses = filters.statuses ?? []
    if (methodIds.length || statuses.length > 1) {
      return filterPage(
        (subscription: Subscription) =>
          (!methodIds.length || (subscription.paymentMethodId != null && methodIds.includes(subscription.paymentMethodId)))
          && (statuses.length <= 1 || statuses.includes(subscription.status)),
        filters.page,
        filters.size,
        (page, size) => subscriptionService.list({
          ...filters, paymentMethodId: undefined, paymentMethodIds: undefined, statuses: undefined,
          status: statuses.length === 1 ? statuses[0] : statuses.length > 1 ? undefined : filters.status,
          page, size,
        }),
      )
    }
    return parseResponse(
      subscriptionPageResponseSchema,
      await apiClient.get<unknown>(BASE, {
        params: buildDateOnlyQueryParams({ ...filters, status: statuses[0] ?? filters.status }),
      }),
    )
  },

  async getById(id: number): Promise<Subscription> {
    return parseResponse(subscriptionResponseSchema, await apiClient.get<unknown>(`${BASE}/${id}`))
  },

  async create(payload: SubscriptionWriteRequest): Promise<Subscription> {
    return parseResponse(subscriptionResponseSchema, await apiClient.post<unknown>(BASE, payload))
  },

  async update(id: number, payload: SubscriptionWriteRequest): Promise<Subscription> {
    return parseResponse(subscriptionResponseSchema, await apiClient.put<unknown>(`${BASE}/${id}`, payload))
  },

  async pause(id: number): Promise<Subscription> {
    return parseLifecycleResult(id, await apiClient.post<unknown>(`${BASE}/${id}/pause`))
  },

  async resume(id: number, payload: SubscriptionResumeRequest): Promise<Subscription> {
    return parseLifecycleResult(id, await apiClient.post<unknown>(`${BASE}/${id}/resume`, payload))
  },

  async stop(id: number): Promise<Subscription> {
    return parseLifecycleResult(id, await apiClient.post<unknown>(`${BASE}/${id}/stop`))
  },

  async payments(id: number, params: SubscriptionPageParams): Promise<SubscriptionPaymentPage> {
    return parseResponse(
      subscriptionPaymentPageResponseSchema,
      await apiClient.get<unknown>(`${BASE}/${id}/payments`, {
        params: {
          page: params.page,
          size: params.size,
          sort: `${params.sort},${params.direction}`,
        },
      }),
    )
  },

  async getPaymentById(paymentId: number): Promise<SubscriptionPayment> {
    return parseResponse(
      subscriptionPaymentResponseSchema,
      await apiClient.get<unknown>(`/v1/subscription-payments/${paymentId}`),
    )
  },

  async generateNextPayment(subscriptionId: number): Promise<GeneratePaymentResult> {
    if (!Number.isSafeInteger(subscriptionId) || subscriptionId <= 0) {
      throw new Error('A valid subscription ID is required.')
    }
    return parseResponse(
      generatePaymentResponseSchema,
      await apiClient.post<unknown>(`${BASE}/${subscriptionId}/payments/generate-next`),
    )
  },

  async backfillSubscriptionPayment(
    subscriptionId: number,
    payload: BackfillSubscriptionPaymentRequest,
  ): Promise<BackfillSubscriptionPaymentResult> {
    if (!Number.isSafeInteger(subscriptionId) || subscriptionId <= 0) {
      throw new Error('A valid subscription ID is required.')
    }
    const body: BackfillSubscriptionPaymentRequest = { scheduledBillingDate: payload.scheduledBillingDate }
    if (payload.paidDate) body.paidDate = payload.paidDate
    return parseResponse(
      backfillPaymentResponseSchema,
      await apiClient.post<unknown>(`${BASE}/${subscriptionId}/payments/backfill`, body),
    )
  },
}

export function backfillSubscriptionPayment(
  subscriptionId: number,
  payload: BackfillSubscriptionPaymentRequest,
): Promise<BackfillSubscriptionPaymentResult> {
  return subscriptionService.backfillSubscriptionPayment(subscriptionId, payload)
}
