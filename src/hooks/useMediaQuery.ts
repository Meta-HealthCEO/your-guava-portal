import { useCallback, useSyncExternalStore } from 'react'

function canMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/**
 * Tracks whether a CSS media query currently matches.
 *
 * `fallback` is reported wherever `matchMedia` is unavailable (server
 * rendering, bare test environments), so callers choose the safe default.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (!canMatchMedia()) return () => {}
    const mediaQueryList = window.matchMedia(query)
    mediaQueryList.addEventListener('change', onChange)
    return () => mediaQueryList.removeEventListener('change', onChange)
  }, [query])

  const getSnapshot = useCallback(
    () => (canMatchMedia() ? window.matchMedia(query).matches : fallback),
    [query, fallback],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => fallback)
}
