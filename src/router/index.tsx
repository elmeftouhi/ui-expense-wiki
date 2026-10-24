import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ExpensesPage } from '@/features/expenses/pages/ExpensesPage'
import { ExpenseDetailsPage } from '@/features/expenses/pages/ExpenseDetailsPage'
import { ExpenseFormPage } from '@/features/expenses/pages/ExpenseFormPage'
import { OverdueExpensesPage } from '@/features/expenses/pages/OverdueExpensesPage'
import { ExpenseStatisticsPage } from '@/features/expenses/pages/ExpenseStatisticsPage'
import { CategoriesPage } from '@/features/categories/pages/CategoriesPage'
import { ReceiptsPage } from '@/features/receipts/pages/ReceiptsPage'
import { BudgetsPage } from '@/features/budgets/pages/BudgetsPage'
import { BudgetDetailsPage } from '@/features/budgets/pages/BudgetDetailsPage'
import { SubscriptionsPage } from '@/features/subscriptions/pages/SubscriptionsPage'
import { SubscriptionDetailsPage } from '@/features/subscriptions/pages/SubscriptionDetailsPage'
import { TenantManagementPage } from '@/features/tenants/pages/TenantManagementPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { LoginPage, RegisterPage } from '@/features/auth'
import { Navigate } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'expenses',
        element: <ExpensesPage />,
      },
      {
        path: 'expenses/new',
        element: <ExpenseFormPage />,
      },
      {
        path: 'expenses/overdue',
        element: <OverdueExpensesPage />,
      },
      {
        path: 'expenses/statistics',
        element: <ExpenseStatisticsPage />,
      },
      {
        path: 'expenses/:expenseId/edit',
        element: <ExpenseFormPage />,
      },
      {
        path: 'expenses/:expenseId',
        element: <ExpenseDetailsPage />,
      },
      {
        path: 'budgets',
        element: <BudgetsPage />,
      },
      {
        path: 'budgets/:budgetId',
        element: <BudgetDetailsPage />,
      },
      {
        path: 'subscriptions',
        element: <SubscriptionsPage />,
      },
      {
        path: 'subscriptions/:subscriptionId',
        element: <SubscriptionDetailsPage />,
      },
      {
        path: 'categories',
        element: <CategoriesPage />,
      },
      {
        path: 'receipts',
        element: <ReceiptsPage />,
      },
      {
        path: 'tenants',
        element: <TenantManagementPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
])
