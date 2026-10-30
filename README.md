# expense.wiki — Multi-Tenant Expense Management Frontend

A corporate, multi-tenant expense management application built with **React**, **TypeScript**, and **Vite**, featuring **shadcn/ui**, **Tailwind CSS**, **TanStack Query**, **React Router**, **React Hook Form**, **Zod**, and **Recharts**.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js `v20.0.0` or higher
- npm `v10.0.0` or higher (use `npm.cmd` if PowerShell execution policy restricts standard script execution)

### 2. Installation
```bash
# Clone and enter workspace
cd ui-expense-wiki

# Install dependencies
npm.cmd install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Environment variables:
- `VITE_API_BASE_URL`: Base URL for the expense API backend (defaults to `http://localhost:8080`)
- `VITE_DEFAULT_LOCALE`: Default fallback locale (e.g. `en-US`)
- `VITE_DEFAULT_CURRENCY`: Default fallback currency (e.g. `USD`)

### 4. Running the Development Server
```bash
npm.cmd start
```
(`npm.cmd run dev` also works.)
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Building & Quality Checks
```bash
# TypeScript strict type checking
npm.cmd run typecheck

# ESLint code quality check
npm.cmd run lint

# Budget unit and UI interaction tests
npm.cmd test

# Production bundle build
npm.cmd run build
```

---

## 🏛️ Project Structure

### Payment methods

Workspace administrators manage payment methods in **Organization settings**:
add or edit a name and type, activate a method, and set the default. Supported types
are `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `DIGITAL_WALLET`, `CHECK`,
and `OTHER`. New expenses and subscriptions select the active default; editing
preserves the saved selection. Forms send `paymentMethodId`, while response
`paymentMethodName` supplies the display label.

The integration uses `GET /v1/payment-methods?showInactive=true`,
`POST /v1/payment-methods`, `PUT /v1/payment-methods/{id}`, and
`PATCH /v1/payment-methods/{id}/set-default`. **Remove** deactivates a method using
`PUT`, because the API has no delete endpoint. Existing records retain their
links, and inactive methods remain available as historical list filters. Switch
the default before removing it.

Expense and subscription lists can filter by payment method. The current backend
does not accept that filter, so the frontend loads all pages matching the other
filters, filters by method ID, and then paginates. Subscription recurring totals
use the same selection. This is correct across pages but can require multiple
requests for large workspaces; server-side method filtering would remove that
overhead.

The subscriptions page uses a vertical filter sidebar on desktop, stacked above
the list on smaller screens. Category, status, and payment-method checkboxes
support multiple selections: options within a group match any selection, and
groups combine together. Selecting or clearing a parent category also selects or
clears all its descendants, including when removing a selected category badge.
Unrelated categories keep their selection. No selection means all options.
Parent categories, Status, and Payment methods have expand/collapse buttons.
Collapsing hides their options without clearing selections; all start expanded.
**Clear all** resets the filters and search. Recurring totals follow the same
filters as the list. Multiple statuses use the same full-result filtering approach
as payment methods, before pagination, since the API accepts only one status.

The expense list also offers a **Payment status** filter: **All statuses**,
**Paid**, or **Pending**. Pending matches only `PENDING`, not `OVERDUE` or
`CANCELLED`. Selecting a status sends `status=PAID` or `status=PENDING` to
`GET /v1/expenses`; All statuses omits the parameter. The server filters status
before pagination. When combined with a payment-method filter, the status is
preserved in every page request used for client-side payment-method filtering.

The project employs a clean **feature-based** modular architecture designed for enterprise scaling:

```
ui-expense-wiki/
├── public/                 # Static assets
├── src/
│   ├── api/                # Network abstraction & query configuration
│   │   ├── client.ts       # Shared typed native-fetch client (extensible for headers/auth)
│   │   ├── config.ts       # API base URL and global fetch options
│   │   └── query-keys.ts   # Tenant-scoped TanStack Query key factory
│   │
│   ├── components/         # Shared presentation layer
│   │   ├── layout/         # Application shell (Desktop Sidebar, Header, MobileNav)
│   │   │   ├── AppShell.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileNav.tsx
│   │   └── ui/             # shadcn/ui design primitives (Button, Card, Badge, Input, Chart, etc.)
│   │
│   ├── features/           # Domain feature modules
│   │   ├── auth/           # Authentication types & credentials contracts
│   │   ├── budgets/        # Live budgets, category selection, period history & adjustments
│   │   ├── categories/     # Category classification & department budget tracking
│   │   ├── dashboard/      # Analytics, KPI metrics, and reporting models
│   │   ├── expenses/       # Ledger, filters, expense lifecycle types & states
│   │   ├── receipts/       # OCR ingestion, document queue & upload models
│   │   ├── settings/       # Live tenant configuration, regional formats & reminders
│   │   └── tenants/        # Multi-tenant context, demo tenants, role types & switcher
│   │
│   ├── lib/                # Utility helpers & agnostic formatters
│   │   ├── formatters.ts   # Agnostic currency, date, and number localization
│   │   └── utils.ts        # shadcn `cn` className merger
│   │
│   ├── providers/          # Root providers (TanStack QueryClientProvider, TenantProvider)
│   ├── router/             # React Router configuration
│   ├── types/              # Common schemas (Pagination, API errors, sorting)
│   ├── App.tsx             # Root application orchestrator
│   ├── index.css           # Tailwind CSS design system tokens
│   └── main.tsx            # DOM root mounting
│
├── .env.example            # Environment template without secrets
├── eslint.config.js        # Modern flat ESLint configuration
├── tsconfig.json           # Root TypeScript configuration
├── tsconfig.app.json       # App compiler options with @/* path aliases
├── vite.config.ts          # Vite configuration with React & Tailwind plugins
└── openapi-spec.json       # Backend OpenAPI specification
```

---

## Dashboard charts

The dashboard spending chart loads live data from
`GET /v1/expenses/charts/daily?year=YYYY&month=M` and
`GET /v1/expenses/charts/monthly?year=YYYY`, scoped to the active tenant.
It starts at the current month/year and supports navigation through the current
and previous two years. Monthly comparisons use `previousYearTotals`; totals,
averages, and peaks are calculated from the returned data, including zero totals.
Loading, errors with retry, and empty periods are shown without demo fallbacks.
Transaction counts and monthly budgets are not displayed because these endpoints
do not return them. Other dashboard KPI, upcoming-expense, and category cards
still use demo data.

## Expense statistics

The statistics endpoint returns `byCategory` as a recursive hierarchy. Each category
has `categoryId`, `categoryName`, `total`, nullable `parentTotal`, and a
`subCategories` array (empty for leaves). The breakdown shows category names and
expense amounts, with branches collapsed by default. Use each parent's chevron
control to expand or collapse its subcategories at any depth. Colored folder
and tag icons distinguish groups and leaves; children inherit their group's
color. Child amounts are not added again to the summary totals. Budget and
percentage fields are not required from the API.

## Budgets

`/budgets` provides searchable cards and a table with current-period allocation,
spend, remaining funds, health, and OPEN/CLOSED status. Create and edit dialogs
support category multi-selection, periodicity, active status, and amount/percentage
warnings. `/budgets/:budgetId` provides defaults, current-period details, period
history, and adjustments scoped to an individual period. The dashboard budget
widget uses the same API queries rather than mock budgets.

Existing desktop and mobile Budgets menu entries already point to `/budgets`;
details links now resolve to `/budgets/:budgetId`. Mutation controls are hidden
for viewers. Forms and filters reset on workspace changes, query keys are
tenant-scoped, and requests use the shared client's active-workspace JWT.

### API integration

The service calls all six budget endpoints: POST/GET `/v1/budgets`, GET/PUT
`/v1/budgets/{id}`, GET `/v1/budgets/{id}/periods`, and PATCH
`/v1/budgets/{id}/periods/{periodId}`.

The bundled `openapi-spec.json` does **not** currently document budget responses.
The UI retains the initial implementation's response contract: budget and period
lists are JSON arrays, create/update endpoints return the updated resource, and
budget objects include an optional nullable `currentPeriod`. Budget category IDs
are numeric; periods contain `startDate`, `endDate`, `allocatedAmount`,
`spentAmount`, `warningType`, `warningThreshold`, and `status`. See
`src/features/budgets/types/index.ts` for full interfaces. Numeric amounts can be
JSON numbers or decimal strings. Invalid responses produce an explicit error,
not fabricated zero balances. Confirm these response shapes against the running
backend before deployment.

Validation requires a nonblank name, a positive allocation, at least one category,
and a nonnegative warning threshold. Percentage thresholds cannot exceed 100;
amount thresholds are not subject to that cap. Budget changes affect defaults
for future periods; adjustments affect only the selected existing period.

### Tracking behavior

- Categories can belong to multiple budgets. An expense counts toward each matching budget; portfolio totals can overlap and are not unique expense totals.
- Expense deductions and recalculation on expense updates/deletions happen in the backend.
- Periods are created lazily when a matching expense is created. A missing current period is not displayed as an existing zero-spend period.
- Old expense linking requires the matching period instance to already exist; adding a category does not create historical periods.

Expense changes invalidate the tenant's budgets so budget spend stays current.
Budget pages refresh on navigation/window focus when stale and expose manual
refresh/retry controls.

### Feature file inventory

All paths below are relative to `src/features/budgets/`:

```text
types/index.ts                         API contracts and UI summary types
schemas/budgetSchema.ts                Shared form validation and payload mapping
schemas/budgetResponseSchema.ts        Runtime response validation
services/budgetService.ts              Six API operations
hooks/useBudgets.ts                    Queries, mutations and cache invalidation
hooks/useCategoryOptions.ts            Category query adapter
utils/budgetMath.ts                    Health, totals and period formatting
utils/categoryOptions.ts               Hierarchical category flattening
utils/currency.ts                      Localized currency adornments
pages/BudgetsPage.tsx                  List, filters and create/edit actions
pages/BudgetDetailsPage.tsx            Details, history and adjustment actions
components/BudgetCard.tsx              List card
components/BudgetsTable.tsx            Table view
components/BudgetCategoryChips.tsx     Tracked-category labels
components/BudgetConsumptionWidget.tsx Live dashboard integration
components/BudgetDialog.tsx            Keyboard-accessible dialog shell
components/BudgetFormModal.tsx         Create/edit form
components/CategoryMultiSelect.tsx     Searchable category checklist
components/FormControls.tsx           Shared form controls
components/PeriodEditModal.tsx         Period adjustment form and preview
components/PeriodHistoryTable.tsx      Period history
components/BudgetHelpPanel.tsx         Backend behavior help
components/BudgetProgressBar.tsx       Allocation usage visualization
components/BudgetStatusBadges.tsx      Health and period status
index.ts                              Public feature exports
__tests__/fixtures.ts                  Shared test data
__tests__/budgetLogic.test.ts          Validation, thresholds, totals, dates, categories
__tests__/budgetService.test.ts        Endpoint payloads and malformed-response errors
__tests__/budgetForms.test.tsx         Form validation, selection, save errors, focus
__tests__/budgetPages.test.tsx         Navigation, roles, retries, tenant reset, cache updates
```

Related integration files are `src/router/index.tsx`,
`src/api/query-keys.ts`, `src/features/dashboard/pages/DashboardPage.tsx`,
`src/lib/api-error.ts`, and the shared toast components in `src/components/ui/`.
Test configuration lives in `vite.config.ts`, `src/test/setup.ts`, and the
`test`/`test:watch` scripts in `package.json`.

---

## Subscriptions

Subscriptions are independent recurring commitment definitions, not expense
records. The dedicated `/subscriptions` list uses server-side search, category,
and status filters, pagination, and sorting by
`nextBillingDate` or `name`. `/subscriptions/:subscriptionId` displays schedule
details and paginated payments history. Desktop and mobile navigation both
include Subscriptions.

The list footer offers 10 (default), 25, 50, or 100 rows per page. Changing the
page size returns to the first page while preserving search, filters, and sorting.

On Subscriptions, selecting a category includes its own ID and every nested
subcategory ID. List and total requests send `categoryIds` as a comma-separated
array query parameter (for example, `categoryIds=5,8,9`). Included categories
appear as removable labels below the filters. Removing a label excludes only
that ID, not its descendants; removing the last label clears category filtering.
Choosing another category replaces the group, and clearing the picker removes
all category labels. Each change returns the list to the first page and refreshes
both cost cards.

The compact list groups each subscription's name and category, followed by amount,
frequency, next billing, and accessible icon actions for details and editing.
Editing opens the prefilled subscription form for editors on active or paused
schedules; stopped and ended schedules remain read-only. Pause, resume, and
confirmed stop are available only in the detail view.
End date, status, and reminder settings remain in the detail
view rather than separate list columns. Active schedules show the backend's
`overdue` flag and `daysLeftBeforeDueDate` (including due today) beside its
`nextBillingDate`; the UI does not derive urgency or next billing from dates.
Inactive schedules do not show billing urgency. This describes the schedule, not the payment status of a
linked expense. List totals remain in the pagination footer; there is no separate
matching-subscription statistics strip.

Monthly and yearly equivalents appear in two separate cards, side by side on
larger screens and stacked on mobile. They cover **all subscriptions matching the
current search, category, and status filters**, across all pages. With no status
filter, all statuses are included; selecting a status totals only that status.
Changing the page, page size, or sort does not change the totals.
The UI loads every matching page; a
failed page exposes an error/retry rather than a partial total. Subscription
amounts, monthly equivalents, and total cards use the active workspace's currency
and locale via `formatTenantCurrency` in `src/lib/formatters.ts`, rather than
legacy currency codes on subscription records. The numeric amounts are treated
as workspace-denominated; this is formatting, not exchange-rate conversion.
Create/edit forms explicitly submit the workspace currency. Historical generated
expenses in payment history retain their recorded expense currency.
Lifecycle changes invalidate the totals.
These are average recurring commitments, not historical paid expenses or an
exact forecast of payments in a particular calendar month/year. Monthly schedules
are multiplied by 12, quarterly by 4, semiannual by 2, and annual/legacy yearly by 1.
Daily, weekly, biweekly, and custom intervals use `365 / intervalDays` billings per
year; a custom 90-day interval is therefore distinct from a calendar quarter, and
180 days is distinct from six calendar months. The monthly equivalent is the
unrounded yearly total divided by 12; only display formatting rounds amounts.
For non-monthly subscriptions, the list also shows this calculated monthly
equivalent beneath the original billed amount, using the same normalization
and the workspace's currency. Monthly subscriptions show only their amount.

The UI calls only independent subscription endpoints:

| UI operation | API |
|---|---|
| Create | `POST /v1/subscriptions` |
| List/search/filter/page/sort | `GET /v1/subscriptions` |
| Details | `GET /v1/subscriptions/{id}` |
| Edit future schedule | `PUT /v1/subscriptions/{id}` |
| Pause | `POST /v1/subscriptions/{id}/pause` |
| Resume with required next date | `POST /v1/subscriptions/{id}/resume` with `{ "nextBillingDate": "YYYY-MM-DD" }` |
| Stop permanently | `POST /v1/subscriptions/{id}/stop` |
| Payments history | `GET /v1/subscriptions/{id}/payments` |
| Linked payment details | `GET /v1/subscription-payments/{paymentId}` |
| Generate next payment | `POST /v1/subscriptions/{subscriptionId}/payments/generate-next` |

All subscription queries are tenant-scoped and use the shared authenticated API
client. Lifecycle mutations invalidate list, detail, and payment history caches.
Only ACTIVE schedules can be paused, PAUSED schedules can be resumed, and ACTIVE
or PAUSED schedules can be stopped. STOPPED and ENDED schedules cannot be edited
or restarted. Resume requires an explicit billing date; missed dates while paused
are not submitted for catch-up by this UI.

Amounts/currency, frequency, next billing date, optional end date, category,
payment metadata, and reminder lead time belong to the subscription definition.
The category is selected from the active workspace. Date-only request and filter
values are serialized as `YYYY-MM-DD` without UTC conversion. The UI supports
MONTHLY, ANNUAL, DAILY, WEEKLY, BIWEEKLY, QUARTERLY, SEMIANNUAL, CUSTOM, and
legacy YEARLY values; custom frequency requires a positive interval in days.

The backend, not this UI, creates each payment and a linked PENDING expense when
its scheduled billing date arrives. Subscription definitions are not included
in the expense ledger or actual-spend totals. Pausing/stopping does not change
generated expenses. Payment history uses `expenseId` to link to individual
expenses, and includes scheduled billing date, amount, currency, status, due date,
and paid date. No legacy history route fallback is needed.

### Payment-model UI changelog

- Expenses retain all normal status actions and show a Subscription badge for
  payment-linked or legacy subscription-origin expenses.
- An optional `subscriptionPaymentId` on an expense enables loading the explicit
  payment resource and navigating to its subscription. No subscription ID is
  inferred from the expense.
- Subscription details use payment terminology and include loading, empty, error,
  retry, refresh, and pagination states for payments history.
- "Generate next payment" calls
  `POST /v1/subscriptions/{subscriptionId}/payments/generate-next` with no body
  (ACTIVE subscriptions only). `generated: true` shows a success toast;
  `alreadyExists: true` shows an informational toast and creates nothing. The
  backend `message` is used as the toast description, and the returned
  `paymentId`/`expenseId` render an inline link to the expense. The button is
  disabled while the request is in flight to prevent duplicate clicks. Both
  outcomes refetch payment history, subscriptions, and expenses without
  optimistically appending rows.
- Expense edits/status changes invalidate payment history and payment details so
  the history reflects the current expense status.

The current bundled `openapi-spec.json` still documents the deprecated
expense-nested subscription contract. The feature intentionally does not use
those routes and instead validates the independent API DTOs described in
`src/features/subscriptions/types/index.ts` and
`src/features/subscriptions/schemas/subscriptionResponseSchema.ts`. Confirm those
response shapes against the deployed backend/OpenAPI before release.

Feature implementation and tests are under `src/features/subscriptions/`;
navigation/routing/query-key integrations are in
`src/components/layout/Sidebar.tsx`, `src/components/layout/MobileNav.tsx`,
`src/router/index.tsx`, and `src/api/query-keys.ts`.

---

## Expenses

`/expenses` is the tenant-scoped expense ledger with year, month, category, and
type filters, server pagination, and sorting by description, amount, or due
date. `/expenses/new` and `/expenses/:expenseId/edit` create and update expense
records; `/expenses/:expenseId` displays a record and its lifecycle actions.
`/expenses/overdue` loads the backend overdue view, and
`/expenses/statistics` fetches date-range totals and category breakdowns.

The ledger keeps text search and an **Add categories** tree picker visible.
Search sends the trimmed `search` query parameter after a short debounce.
Picking a parent adds the parent and all descendant categories, without
duplicates; selected categories appear as removable chips beneath the search
row. Removing a chip excludes only that ID, and **Clear categories** removes
the category filter. Requests send comma-separated IDs as `categoryIds=5,8`.
**More filters** reveals year, month, type, payment status, payment method, and
rows per page; collapsing it preserves those selections. The active-filter
count includes the current year and month defaults. Filter changes return to
the first page.

Expense entry starts with the category tree picker (see "Category picker").
Choosing a category focuses the amount field. Descriptions are
optional: blank or whitespace-only descriptions are replaced with the selected
category name before sending the create/update request. Custom descriptions
are preserved.

When creating an expense, the paid date defaults to today. Normal expenses hide
the due date field and send the paid date (or today, if cleared) as `dueDate`;
subscription bills show the due date. The edit form always shows both dates.

On the create form, **Save and add new** saves to the backend and then resets all
fields to their new-expense defaults, focusing the category picker without
leaving the page. Failed saves keep the entered values and show an error.
**Record expense** still opens the saved expense's details.

The expense list is compact. Each row shows the description, with the category
and a Subscription badge underneath, then the amount, the status, and the due
date (with the paid date below it, if set). Row actions take two icon buttons:
a quick "mark as paid" check (only for unpaid expenses) and a "⋯" menu with
View details, Edit, Change status, and Delete. The menu supports the keyboard
(arrow keys, Home/End, Escape) and closes on an outside click. Below 768px the
table turns into a stacked card list with a "Sort by" control. The expense
details page keeps the full row of labelled action buttons.

The expense ledger uses `/v1/expenses`: GET list/detail/overdue/statistics,
POST create, PUT update, DELETE soft-delete, and PATCH status/mark-as-paid.
Date-only request values remain `YYYY-MM-DD`. Successful mutations invalidate
expense list, detail, overdue, and statistics queries, as well as dashboard and
budget data. The API client supplies the existing authentication token; cached
expense data is partitioned by active tenant.

An expense with `type=SUBSCRIPTION` is an actual bill and may be edited or paid
as an expense. It is not a recurring subscription definition. Subscription
schedules are managed only from `/subscriptions`; changing or deleting an
expense does not create or alter a subscription schedule. Payments history
links directly to expense details. When `subscriptionPaymentId` is available,
expense details also load `/v1/subscription-payments/{paymentId}` and use the
payment's `subscriptionId` to link to its schedule.

---

## Category ordering

The Categories page shows a compact heading and list without summary cards.
Successful category actions use compact, floating bottom-right notifications
instead of inline banners, so feedback does not shift the page content.
Editors and administrators can drag the grip handle to place a category above
or below a sibling, with a grab/grabbing cursor and a highlighted insertion
line. The grip sits at the beginning of each row, and a full-width row preview
follows the cursor while dragging. Parent categories move with their children; subcategories stay within
their own parent. Up/down buttons remain available for keyboard and touch use
in tree and grid views. Releasing outside a valid target cancels the move.
Each move sends
`PATCH /v1/categories/{id}/level` with `{ "level": 1 }` (a 1-based sibling
position); the backend shifts the other siblings automatically. Lists are
sorted by the returned `level`, not by hierarchy depth.

Reordering waits for the refreshed server list and is disabled while searching
or filtering by status. Failures remain visible and refresh the server order.
Editing details preserves an existing position; new/reparented categories omit
`level` so the backend assigns their position.

## Category icons

The category create/edit form offers 95 icons (`categoryIcons.ts`), grouped by
theme (Home & utilities, Food & drink, Transport & travel, Health & family,
Leisure & shopping, Money & finance, Work & business) with a search box that
matches icon labels and group names. Icon names are stored on the category, so
existing entries must never be renamed; the original 20 icons are unchanged.

## Category picker

Category dropdowns follow the saved `level` order for root categories and each
group of siblings, matching the Categories page instead of sorting by name.
Children remain nested under their parent; categories without a level follow
ranked siblings, preserving API order for ties.

Every single-category choice (expense form, subscription form, and the
category filter on Subscriptions), plus the additive category picker on
Expenses, uses `CategoryTreeSelect`
(`src/features/categories/components/CategoryTreeSelect.tsx`) instead of a
native `<select>` or the old card grid. It is a compact field that opens a
tree popover:

- Parents and subcategories are both selectable; chevrons (or ←/→ keys)
  expand and collapse branches, and collapsed parents show a child count.
- The field shows the category icon and its parent path ("Groceries in Food").
- Reopening reveals the current selection; searching shows matches with their
  parents expanded, and Enter picks the first match.
- Filters add an "All categories" option that clears the selection.
- Full tree keyboard support (↑/↓, Home/End, ←/→, Enter/Space); Escape closes
  the popover without closing a surrounding dialog.

## Workspace settings

`/settings` loads the active tenant's configuration with `GET /v1/config`.
Administrators can update all twelve editable fields with `PUT /v1/config`;
other roles have read-only access. IDs and audit fields are displayed separately
and never included in the update payload. Loading, retry, validation, save errors,
and unsaved changes are shown explicitly.

Notification channels and payment reminder days are edited as comma-separated
lists and sent as JSON-encoded strings (`"[\"IN_APP\"]"` and `"[3,7]"`).
Empty lists are sent as `"[]"`. Currency, language, time format, and week-start
options follow the bundled OpenAPI enums. Rounding methods, reporting periods,
and notification channel codes remain text inputs because their allowed values
are not enumerated in that contract.

Requests use the shared authenticated client and an explicit tenant header;
queries are tenant-scoped and drafts reset when switching workspaces.
Saving updates the configuration cache from the server response. The tenant
provider reads the same cache so currency displays throughout the workspace
update immediately after a successful save. On reload and tenant switch,
configuration loads before the workspace is displayed, avoiding a flash of
the fallback currency. Failed initial configuration loads show a retry action.
The configured language supplies the tenant's formatting locale as a language
tag (for example, `FR` becomes `fr`); the API does not provide a regional locale.
The top navigation and selected workspace dropdown row share these configured
values. Other workspace rows show names only because their configuration has
not been loaded. Other preferences remain stored backend settings; this screen
does not translate the interface or apply custom date patterns.

---

## 🏢 Multi-Tenant Architectural Foundation

1. **Active Tenant Context (`TenantProvider` & `useActiveTenant`)**:
   - Manages current organization, role assignment (`ADMIN`, `EDITOR`, `VIEWER`), and available demo workspaces (`Acme Corp`, `Nexus Global Labs`, `Nordic Studio`).
   - Automatically synchronizes document title and user session display.

2. **Tenant State Clearance & Cache Isolation**:
   - Switching tenants automatically purges all tenant-scoped TanStack Query cache (`queryClient.removeQueries({ predicate: q => q.queryKey[0] === 'tenant' })`).
   - Emits a `tenant-switched` event and exposes `useResetOnTenantChange` to clear transient component filter inputs when shifting organizations.

3. **Tenant-Scoped Query Keys (`src/api/query-keys.ts`)**:
   - Hierarchical key factory ensures queries are scoped by tenant ID:
     ```ts
     queryKeys.tenantScope(activeTenant.id).expenses.list(filters)
     queryKeys.tenantScope(activeTenant.id).dashboard.stats()
     ```

4. **Security & Role Boundaries**:
   - **Frontend role checks** (e.g. `isAdmin`, `canEdit`) are strictly **UI convenience helpers** to disable or hide buttons.
   - **Backend API enforcement**: Multi-tenant authorization, tenant header injection, and data isolation must be validated on the server. The tenant identification mechanism in `src/api/client.ts` is explicitly scaffolded and left for the backend API integration phase.

5. **Separation of Concerns**:
   - Tenant Administration (`/tenants`) is segregated from operational Expense Management (`/expenses`, `/categories`, `/receipts`).

---

## 🌐 Localization & Currency Handling

The application does not hardcode currencies or locales:
- Utilities in `src/lib/formatters.ts` (`formatCurrency`, `formatDate`, `formatNumber`) dynamically accept currency and locale parameters.
- Active tenant workspaces dynamically drive their own preferred currency (e.g. `USD`, `EUR`, `SEK`) and locale formats.
