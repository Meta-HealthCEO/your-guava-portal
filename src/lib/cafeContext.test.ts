import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTabCafeId, getTabCafeId, setTabCafeId, TAB_CAFE_STORAGE_KEY } from './cafeContext'

describe('tab cafe context', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    clearTabCafeId()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the cafe per tab in sessionStorage under a stable key', () => {
    setTabCafeId('cafeA')
    expect(getTabCafeId()).toBe('cafeA')
    expect(TAB_CAFE_STORAGE_KEY).toBe('yg.tabCafeId')
    expect(sessionStorage.getItem('yg.tabCafeId')).toBe('cafeA')
  })

  it('never uses localStorage, which every tab shares', () => {
    setTabCafeId('cafeA')
    expect(localStorage.getItem('yg.tabCafeId')).toBeNull()
  })

  it('still scopes the page when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    setTabCafeId('cafeMemory')
    expect(getTabCafeId()).toBe('cafeMemory')
  })

  it('clears both copies', () => {
    setTabCafeId('cafeA')
    clearTabCafeId()
    expect(getTabCafeId()).toBeNull()
    expect(sessionStorage.getItem('yg.tabCafeId')).toBeNull()
  })
})
