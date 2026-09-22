import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMediaQuery } from './useMediaQuery'

type ChangeListener = (event: { matches: boolean }) => void

function stubMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<ChangeListener>()
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches,
    media: query,
    addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
  })))
  return {
    fire(nextMatches: boolean) {
      matches = nextMatches
      listeners.forEach((listener) => listener({ matches: nextMatches }))
    },
  }
}

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the fallback when matchMedia is unavailable', () => {
    expect(typeof window.matchMedia).toBe('undefined')

    const { result } = renderHook(() => useMediaQuery('(min-width: 80rem)', true))

    expect(result.current).toBe(true)
  })

  it('reports the current match and follows change events', () => {
    const media = stubMatchMedia(false)

    const { result } = renderHook(() => useMediaQuery('(min-width: 80rem)', true))
    expect(result.current).toBe(false)

    act(() => media.fire(true))
    expect(result.current).toBe(true)
  })
})
