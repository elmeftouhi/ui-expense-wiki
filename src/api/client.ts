import { API_CONFIG } from './config'
import { authStorage } from '@/features/auth/services/authStorage'

export class ApiClientError extends Error {
  public readonly status: number
  public readonly data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.data = data
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  tenantId?: string | number | null
  skipAuth?: boolean
}

/**
 * Shared typed native-fetch client foundation.
 * Prepared for multi-tenant headers and authorization without calling real endpoints yet.
 */
export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Helper to build URL with query parameters.
   */
  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const base =
      this.baseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
    const url = new URL(cleanEndpoint, base)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return url.toString()
  }

  /**
   * Core request dispatch pipeline using native fetch.
   */
  public async request<TResponse>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<TResponse> {
    const { params, body, headers, tenantId: _tenantId, ...fetchOptions } = options
    const url = this.buildUrl(endpoint, params)

    const requestHeaders: Record<string, string> = {
      ...API_CONFIG.defaultHeaders,
      ...((headers as Record<string, string>) || {}),
    }

    // Auto-inject saved JWT token unless explicitly skipped
    const token = authStorage.getToken()
    if (token && !options.skipAuth && !requestHeaders['Authorization']) {
      requestHeaders['Authorization'] = `Bearer ${token}`
    }

    // Auto-inject tenant ID header only if explicitly specified in options
    if (options.tenantId && !requestHeaders['X-Tenant-ID']) {
      requestHeaders['X-Tenant-ID'] = String(options.tenantId)
    }

    let requestBody: BodyInit | undefined = undefined
    if (body !== undefined) {
      if (body instanceof FormData || typeof body === 'string' || body instanceof Blob) {
        requestBody = body as BodyInit
        if (body instanceof FormData) {
          // Let browser set multipart boundary
          delete requestHeaders['Content-Type']
        }
      } else {
        requestBody = JSON.stringify(body)
      }
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        body: requestBody,
      })

      if (!response.ok) {
        let errorData: unknown
        try {
          errorData = await response.json()
        } catch {
          errorData = await response.text()
        }
        if (response.status === 401 && !options.skipAuth) {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'))
        }
        throw new ApiClientError(
          `Request failed with status ${response.status}: ${response.statusText}`,
          response.status,
          errorData,
        )
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as unknown as TResponse
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return (await response.json()) as TResponse
      }

      return (await response.text()) as unknown as TResponse
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error
      }
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Unknown network failure',
        0,
      )
    }
  }

  public get<TResponse>(endpoint: string, options?: RequestOptions): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { ...options, method: 'GET' })
  }

  public post<TResponse>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { ...options, method: 'POST', body })
  }

  public put<TResponse>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { ...options, method: 'PUT', body })
  }

  public patch<TResponse>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { ...options, method: 'PATCH', body })
  }

  public del<TResponse>(endpoint: string, options?: RequestOptions): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { ...options, method: 'DELETE' })
  }
}

export const apiClient = new ApiClient()
