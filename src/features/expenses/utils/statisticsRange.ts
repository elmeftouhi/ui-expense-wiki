export function currentMonthStatisticsRange() {
  const today = new Date()
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  return {
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${String(today.getDate()).padStart(2, '0')}`,
  }
}
