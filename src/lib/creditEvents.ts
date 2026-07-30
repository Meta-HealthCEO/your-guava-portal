export interface GuavaCreditSnapshot {
  included?: number
  bonus?: number
  used?: number
  available?: number
  resetAt?: string | null
}

export const GUAVA_CREDITS_UPDATED_EVENT = 'guava:credits-updated'

export function publishGuavaCredits(snapshot?: GuavaCreditSnapshot | null): void {
  if (!snapshot || typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<GuavaCreditSnapshot>(GUAVA_CREDITS_UPDATED_EVENT, {
      detail: snapshot,
    })
  )
}
