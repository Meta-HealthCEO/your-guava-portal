export interface User {
  id: string
  email: string
  name: string
  role: 'owner' | 'manager'
  orgId: string
  cafeIds: string[]
  activeCafeId: string
}

export interface Organization {
  _id: string
  name: string
  ownerId: string
  plan: 'free' | 'growth' | 'pro'
}

export interface TeamMember {
  _id: string
  name: string
  email: string
  role: 'owner' | 'manager'
  cafeIds: { _id: string; name: string }[]
  createdAt: string
}

export interface CafeBasic {
  _id: string
  name: string
}

export interface Cafe {
  _id: string
  name: string
  location: { address: string; city: string; lat?: number; lng?: number }
  yocoConnected: boolean
  dataUploaded: boolean
  lastSyncAt?: string
}

export interface ForecastItem {
  itemName: string
  predictedQty: number
  actualQty?: number
  suggestedStock?: number
}

export interface Forecast {
  _id: string
  date: string
  items: ForecastItem[]
  signals: {
    weather: { temp: number; condition: string; humidity: number }
    loadSheddingStage: number
    isPublicHoliday: boolean
    isSchoolHoliday: boolean
    isPayday: boolean
    dayOfWeek: number
    events?: { name: string; impact: string }[]
  }
  totalPredictedRevenue: number
  accuracy?: number
}

export interface LocalEvent {
  _id: string
  name: string
  date: string
  impact: 'low' | 'medium' | 'high'
  notes?: string
  recurring: boolean
}

export interface YocoStatus {
  connected: boolean
  lastSyncAt: string | null
  tokenExpiresAt: string | null
}

export interface TransactionStats {
  totalTransactions: number
  totalRevenue: number
  avgDailyRevenue: number
  topItems: { name: string; qty: number }[]
  firstDate: string
  lastDate: string
}

export interface DayForecast {
  date: string
  label: string
  dayName: string
  dataQuality: 'BASIC' | 'PRO'
  forecast?: Forecast
}

export interface HourlyBreakdown {
  hour: number
  label: string
  items: { name: string; qty: number }[]
  temp?: number
}

export interface TimePeriod {
  id: string
  label: string
  timeRange: string
  hours: number[]
  hourlyData: HourlyBreakdown[]
  totalQty: number
  topItems: { name: string; qty: number }[]
}

// ── Analytics types ──────────────────────────────────────────────────────────

export interface RevenueData {
  date: string
  revenue: number
  transactions: number
}

export interface RevenueAnalytics {
  data: RevenueData[]
  totalRevenue: number
  avgDailyRevenue: number
  bestDay: { date: string; revenue: number }
  worstDay: { date: string; revenue: number }
  trend: number
}

export interface ItemPerformance {
  name: string
  totalQty: number
  totalRevenue: number
  avgPerDay: number
  trend: number
}

export interface HeatmapCell {
  dayOfWeek: number
  hour: number
  revenue: number
  transactions: number
}

export interface CustomerInsights {
  avgTransactionValue: number
  avgItemsPerTransaction: number
  cashVsCardRatio: { cash: number; card: number } | null
  tippingRate: number
  avgTip: number
}

// ── Workforce types ──────────────────────────────────────────────────────────

export interface StaffMember {
  _id: string
  name: string
  email?: string
  phone?: string
  role: 'barista' | 'kitchen' | 'front' | 'manager' | 'other'
  hourlyRate: number
  startDate: string
  isActive: boolean
}

export interface Shift {
  _id: string
  staffId: string | { _id: string; name: string }
  cafeId: string
  date: string
  startTime: string
  endTime: string
  hoursWorked: number
  type: 'regular' | 'overtime'
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
}

export interface ShiftSummary {
  staffId: string
  staffName: string
  totalHours: number
  regularHours: number
  overtimeHours: number
  estimatedPay: number
}

export interface LeaveRequest {
  _id: string
  staffId: string | { _id: string; name: string }
  cafeId: string
  type: 'annual' | 'sick' | 'family' | 'unpaid'
  startDate: string
  endDate: string
  days: number
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: string
}

export interface LeaveBalanceData {
  staffId: string
  staffName?: string
  annual: { total: number; used: number }
  sick: { total: number; used: number }
  family: { total: number; used: number }
}

export interface LeaveCalendarDay {
  date: string
  staff: { name: string; type: string }[]
}
