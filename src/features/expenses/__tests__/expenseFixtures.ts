import type { ExpenseResponse, ExpenseStatisticsResponse } from '../types'

export const expenseStatistics: ExpenseStatisticsResponse = {
  totalExpenses: 1885,
  totalPaid: 1200,
  totalPending: 535,
  totalOverdue: 150,
  overdueCount: 2,
  pendingCount: 5,
  byCategory: [
    {
      categoryId: 10, categoryName: 'Food', total: 650, parentTotal: null,
      subCategories: [
        { categoryId: 11, categoryName: 'Groceries', total: 420, parentTotal: 650, subCategories: [] },
        { categoryId: 12, categoryName: 'Restaurants', total: 230, parentTotal: 650, subCategories: [] },
      ],
    },
    {
      categoryId: 20, categoryName: 'Transport', total: 300, parentTotal: null,
      subCategories: [
        { categoryId: 21, categoryName: 'Fuel', total: 180, parentTotal: 300, subCategories: [] },
        { categoryId: 22, categoryName: 'Taxi', total: 120, parentTotal: 300, subCategories: [] },
      ],
    },
    { categoryId: 30, categoryName: 'Utilities', total: 935, parentTotal: null, subCategories: [] },
  ],
}

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
