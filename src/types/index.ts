export interface User {
  id: string
  email: string
  name: string
  cafeId: string
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
  }
  totalPredictedRevenue: number
  accuracy?: number
}

export interface TransactionStats {
  totalTransactions: number
  totalRevenue: number
  avgDailyRevenue: number
  topItems: { name: string; count: number }[]
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
