interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

async function loadMatches<T>(
  matchesFilter: (item: T) => boolean,
  loadPage: (page: number, size: number) => Promise<Page<T>>,
): Promise<T[]> {
  const matches: T[] = []
  let totalPages = 1
  for (let current = 0; current < totalPages; current += 1) {
    const result = await loadPage(current, 100)
    matches.push(...result.content.filter(matchesFilter))
    totalPages = result.totalPages
  }
  return matches
}

// Apply unsupported API filters across the entire result before paginating.
export async function filterPage<T>(
  matchesFilter: (item: T) => boolean,
  page: number,
  size: number,
  loadPage: (page: number, size: number) => Promise<Page<T>>,
): Promise<Page<T>> {
  const matches = await loadMatches(matchesFilter, loadPage)
  return {
    content: matches.slice(page * size, (page + 1) * size),
    page, size, totalElements: matches.length, totalPages: Math.ceil(matches.length / size),
  }
}

export function loadPaymentMethodMatches<T extends { paymentMethodId?: number | null }>(
  methodId: number,
  loadPage: (page: number, size: number) => Promise<Page<T>>,
): Promise<T[]> {
  return loadMatches((item) => item.paymentMethodId === methodId, loadPage)
}

export function filterPaymentMethodPage<T extends { paymentMethodId?: number | null }>(
  methodId: number,
  page: number,
  size: number,
  loadPage: (page: number, size: number) => Promise<Page<T>>,
): Promise<Page<T>> {
  return filterPage((item) => item.paymentMethodId === methodId, page, size, loadPage)
}
