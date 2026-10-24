import { z } from 'zod'
import { apiClient } from '@/api/client'

export const PAYMENT_METHOD_TYPES = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'CHECK', 'OTHER'] as const
export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHOD_TYPES)[number], string> = {
  CASH: 'Cash', CREDIT_CARD: 'Credit card', DEBIT_CARD: 'Debit card',
  BANK_TRANSFER: 'Bank transfer', DIGITAL_WALLET: 'Digital wallet', CHECK: 'Check', OTHER: 'Other',
}

export const paymentMethodRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter a payment method name.'),
  type: z.enum(PAYMENT_METHOD_TYPES),
  active: z.boolean(),
  isDefault: z.boolean(),
}).refine((value) => !value.isDefault || value.active, {
  message: 'The default payment method must be active.', path: ['active'],
})

const paymentMethodResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  type: z.enum(PAYMENT_METHOD_TYPES),
  active: z.boolean(),
  isDefault: z.boolean(),
})
export type PaymentMethod = z.infer<typeof paymentMethodResponseSchema>
export type PaymentMethodRequest = z.infer<typeof paymentMethodRequestSchema>

const BASE = '/v1/payment-methods'
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) throw new Error('The server returned invalid payment method data. Reload and try again.')
  return result.data
}

export const paymentMethodService = {
  async list(tenantId: number | string, showInactive = false) {
    return parse(z.array(paymentMethodResponseSchema), await apiClient.get<unknown>(BASE, { tenantId, params: { showInactive } }))
  },
  async create(tenantId: number | string, payload: PaymentMethodRequest) {
    return parse(paymentMethodResponseSchema, await apiClient.post<unknown>(BASE, paymentMethodRequestSchema.parse(payload), { tenantId }))
  },
  async update(tenantId: number | string, id: number, payload: PaymentMethodRequest) {
    return parse(paymentMethodResponseSchema, await apiClient.put<unknown>(`${BASE}/${id}`, paymentMethodRequestSchema.parse(payload), { tenantId }))
  },
  async setDefault(tenantId: number | string, id: number) {
    return parse(paymentMethodResponseSchema, await apiClient.patch<unknown>(`${BASE}/${id}/set-default`, undefined, { tenantId }))
  },
}
