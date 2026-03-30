import { vi } from 'vitest'

// Mock API responses
export const mockUser = {
  id: 'user123',
  email: 'test@yourguava.com',
  name: 'Test Owner',
  role: 'owner' as const,
  orgId: 'org123',
  cafeIds: ['cafe123'],
  activeCafeId: 'cafe123',
}

export const mockCafe = {
  _id: 'cafe123',
  name: 'Test Cafe',
  location: { address: '123 Test St', city: 'Cape Town' },
  yocoConnected: false,
  dataUploaded: true,
  lastSyncAt: '2026-03-27T00:00:00.000Z',
}

export const mockForecast = {
  _id: 'forecast123',
  date: '2026-03-28',
  items: [
    { itemName: 'Flat White (Blend)', predictedQty: 30 },
    { itemName: 'Long White (Blend)', predictedQty: 31 },
    { itemName: 'Brownie', predictedQty: 3 },
  ],
  signals: {
    weather: { temp: 24, condition: 'Sunny', humidity: 60 },
    loadSheddingStage: 0,
    isPublicHoliday: false,
    isSchoolHoliday: false,
    isPayday: false,
    dayOfWeek: 5,
  },
  totalPredictedRevenue: 20100,
}

export const mockStats = {
  totalTransactions: 7402,
  totalRevenue: 543000,
  avgDailyRevenue: 6626,
  topItems: [
    { name: 'Flat White (Blend)', qty: 2664 },
    { name: 'Long White (Blend)', qty: 2717 },
  ],
  firstDate: '2025-12-04',
  lastDate: '2026-03-27',
}

export const mockStaffMember = {
  _id: 'staff123',
  name: 'Sarah',
  email: 'sarah@test.com',
  phone: '0821234567',
  role: 'barista' as const,
  hourlyRate: 45,
  startDate: '2025-06-01',
  isActive: true,
}

// Create a mock for the api module
export const createMockApi = () => {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: 'http://localhost:5000/api' },
  }
}
