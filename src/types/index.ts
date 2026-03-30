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
