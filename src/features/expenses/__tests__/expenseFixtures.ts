import type { ExpenseResponse } from '../types'

export const expense: ExpenseResponse = {
  id: 7,
  categoryId: 3,
  categoryName: 'Utilities',
  userId: 2,
  description: 'Electricity bill',
  amount: 82.5,
  currency: 'USD',
  type: 'NORMAL',
  status: 'PENDING',
  dueDate: '2025-02-10',
  paidDate: null,
  paymentMethod: null,
  paymentMethodId: 1,
  notes: null,
  hasSubscription: false,
  tenantId: 1,
  createdAt: '2025-02-01T10:00:00Z',
  updatedAt: '2025-02-01T10:00:00Z',
}
