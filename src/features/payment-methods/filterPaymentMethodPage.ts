interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

// The list endpoints do not yet support paymentMethodId. Filter the entire
// server result before paginating, not just the currently visible page.
export async function loadPaymentMethodMatches<T extends { paymentMethodId?: number | null }>(
  methodId: number,
  loadPage: (page: number, size: number) => Promise<Page<T>>,
): Promise<T[]> {
  const matches: T[] = []
  let totalPages = 1
  for (let current = 0; current < totalPages; current += 1) {
    const result = await loadPage(current, 100)
    matches.push(...result.content.filter((item) => item.paymentMethodId === methodId))
    totalPages = result.totalPages
  }
  return matches
}

export async function filterPaymentMethodPage<T extends { paymentMethodId?: number | null }>(
  methodId: number,
  page: number,
  size: number,
  loadPage: (page: number, size: number) => Promise<Page<T>>,
): Promise<Page<T>> {
  const matches = await loadPaymentMethodMatches(methodId, loadPage)
  return {
    content: matches.slice(page * size, (page + 1) * size),
    page, size, totalElements: matches.length, totalPages: Math.ceil(matches.length / size),
  }
}
