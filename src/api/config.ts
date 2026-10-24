/**
 * Global API and networking configuration.
 */

export const API_CONFIG = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string) || '',
  defaultHeaders: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeoutMs: 30000,
} as const
