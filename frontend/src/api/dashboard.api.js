import apiClient from './client'
import { getOrders } from './orders.api'
import { getLeaveRequests } from './leaveRequests.api'
import {
  getOrderVolume,
  getRevenueComparison,
  getRevenueSummary,
  getRevenueTrend,
} from './reports.api'

function startOfDay(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

async function safeFetch(requestPromise, fallback) {
  try {
    const response = await requestPromise
    return response.data?.data ?? fallback
  } catch {
    return fallback
  }
}

export async function getDashboardOverview(branchId = '') {
  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const currentStart = new Date(today)
  currentStart.setDate(currentStart.getDate() - 6)

  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - 7)

  const previousEnd = new Date(currentStart.getTime() - 1)
  const toApiDate = (date) => date.toISOString()
  const branchParams = branchId ? { branch_id: branchId } : {}

  const [
    orders,
    todayRevenue,
    revenueTrend,
    revenueComparison,
    todayOrderVolume,
    allOrderVolume,
    products,
    leaveRequests,
  ] = await Promise.all([
    safeFetch(getOrders({ limit: 100, ...branchParams }), []),
    safeFetch(
      getRevenueSummary({
        startDate: toApiDate(today),
        endDate: toApiDate(tomorrow),
        ...branchParams,
      }),
      { totalRevenue: 0, count: 0, averageOrderValue: 0 },
    ),
    safeFetch(
      getRevenueTrend({
        startDate: toApiDate(currentStart),
        endDate: toApiDate(tomorrow),
        ...branchParams,
      }),
      [],
    ),
    safeFetch(
      getRevenueComparison({
        currentStart: toApiDate(currentStart),
        currentEnd: toApiDate(tomorrow),
        previousStart: toApiDate(previousStart),
        previousEnd: toApiDate(previousEnd),
        ...branchParams,
      }),
      { currentRevenue: 0, previousRevenue: 0, percentChange: null },
    ),
    safeFetch(
      getOrderVolume({
        startDate: toApiDate(today),
        endDate: toApiDate(tomorrow),
        ...branchParams,
      }),
      [],
    ),
    safeFetch(getOrderVolume(branchParams), []),
    safeFetch(apiClient.get('/products', { params: branchParams }), []),
    safeFetch(getLeaveRequests(branchParams), []),
  ])

  return {
    orders,
    todayRevenue,
    revenueTrend,
    revenueComparison,
    todayOrderVolume,
    allOrderVolume,
    products,
    leaveRequests,
  }
}
