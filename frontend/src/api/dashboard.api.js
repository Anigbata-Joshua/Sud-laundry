import apiClient from './client'
import { getOrders } from './orders.api'
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
    getOrders({ limit: 100, ...branchParams }),
    getRevenueSummary({
      startDate: toApiDate(today),
      endDate: toApiDate(tomorrow),
      ...branchParams,
    }),
    getRevenueTrend({
      startDate: toApiDate(currentStart),
      endDate: toApiDate(tomorrow),
      ...branchParams,
    }),
    getRevenueComparison({
      currentStart: toApiDate(currentStart),
      currentEnd: toApiDate(tomorrow),
      previousStart: toApiDate(previousStart),
      previousEnd: toApiDate(previousEnd),
      ...branchParams,
    }),
    getOrderVolume({
      startDate: toApiDate(today),
      endDate: toApiDate(tomorrow),
      ...branchParams,
    }),
    getOrderVolume(branchParams),
    apiClient.get('/products', { params: branchParams }),
    apiClient.get('/leave-requests'),
  ])

  return {
    orders: orders.data.data,
    todayRevenue: todayRevenue.data.data,
    revenueTrend: revenueTrend.data.data,
    revenueComparison: revenueComparison.data.data,
    todayOrderVolume: todayOrderVolume.data.data,
    allOrderVolume: allOrderVolume.data.data,
    products: products.data.data,
    leaveRequests: leaveRequests.data.data,
  }
}
