# Notification Center Module

Production-ready Notification Center for the Expense app integrating backend notification APIs and real-time Server-Sent Events (SSE) with robust polling fallback.

---

## 📌 Architecture & Design

```
src/features/notifications/
├── types/                   # TypeScript interfaces (Notification, StreamStatus, NotificationPage)
├── schemas/                 # Zod validation schemas & parsing helpers
├── services/                # Typed API client for /v1/notifications endpoints
├── sse/
│   ├── sseParser.ts         # Incremental text/event-stream parser (WHATWG spec compliant)
│   ├── fetchEventSource.ts  # Fetch-based EventSource supporting Bearer JWT & X-Tenant-Id
│   └── notificationStreamManager.ts # Reconnecting SSE manager with exponential backoff
├── store/
│   ├── notificationReducer.ts  # Pure reducer managing optimistic mutations, lifecycle monotonicity, & rollbacks
│   ├── notificationStore.ts    # Centralized external store (useSyncExternalStore compatible)
│   └── notificationRealtime.ts # Realtime coordinator (SSE + 30s/60s fallback polling)
├── context/                 # React Context & Provider (`NotificationProvider`, `useNotifications`)
├── utils/                   # Type-based visual configs, relative time formatting & subject routing
├── components/
│   ├── LiveStreamBadge.tsx     # Pulsing online/connecting/offline indicator
│   ├── NotificationItemRow.tsx # Individual notification with type icons, actions & routing
│   ├── NotificationList.tsx    # Filter tabs (All/Unread/Read/Archived), actions & infinite scroll
│   └── NotificationDrawer.tsx  # Slide-over notification drawer
├── pages/
│   └── NotificationsPage.tsx   # Dedicated full-page notification center (/notifications)
└── __tests__/               # Comprehensive test suites for reducer, store, SSE, and UI
```

---

## 🚀 Endpoints Integrated

- `GET /v1/notifications/page?page={page}&size={size}&status={SENT|READ|ARCHIVED}` — Paginated list
- `GET /v1/notifications/unread/count` — Unread notification count
- `PATCH /v1/notifications/{id}/mark-as-read` — Mark single notification as read
- `PATCH /v1/notifications/{id}/mark-as-archived` — Archive single notification
- `POST /v1/notifications/mark-all-as-read` — Bulk mark all notifications as read
- `GET /v1/notifications/stream` — SSE real-time stream with `Authorization` and `X-Tenant-Id` headers

---

## ⚡ Real-Time SSE & Fallback Strategy

1. **SSE Stream Connection**:
   - Automatically connected after user authentication and active workspace selection.
   - Headers: `Authorization: Bearer <token>`, `X-Tenant-Id: <tenantId>`, `Accept: text/event-stream`.
   - Handled events:
     - `connected`: Sets stream status to `online` (shows green "Live" badge).
     - `notification-created`: Inserts new item at top if matching active filter, increments unread count.
     - `notification-updated`: Patches existing item by ID or updates status.
     - `notifications-bulk-read`: Refetches unread count and first page.

2. **Exponential Backoff**:
   - Reconnects automatically on stream disconnect (1s, 2s, 4s, 8s, 16s, max 30s).
   - On reconnect success: re-fetches unread count and first page to avoid missed events.
   - Fatal status codes (401/403) stop reconnection and mark stream `offline`.

3. **Fallback Polling**:
   - When SSE is not `online`:
     - Unread count is polled every 30 seconds.
     - First page is polled every 60 seconds (only while a notification panel/drawer/page is active).

---

## 🛡️ Optimistic Updates & Race Condition Handling

- **Monotonic Lifecycle**: Status only progresses forward (`SENT` → `READ` → `ARCHIVED`). A status index tracks the furthest state reached, preventing stale page responses or delayed SSE events from reverting state.
- **Rollback on Error**: Single-item and bulk actions update the UI instantly; if the server rejects the request, changes roll back and an error message is presented.
- **Tenant Isolation**: Stream manager and store drop any incoming notification whose `tenantId` does not match the active workspace.

---

## 🎨 Type-Based Color & Icon Mapping

| Notification Type | Icon | Color | Badge |
|---|---|---|---|
| `PAYMENT_REMINDER` | CreditCard | Amber | Amber outline |
| `SUBSCRIPTION_NEXT` | CalendarSync | Purple | Purple outline |
| `EXPENSE_DUE_SOON` | Clock | Amber | Amber outline |
| `EXPENSE_OVERDUE` | AlertOctagon | Destructive (Red) | Red outline |
| `BUDGET_ALERT` | AlertTriangle | Amber | Amber outline |
| `BUDGET_EXCEEDED` | PiggyBank | Destructive (Red) | Red outline |

