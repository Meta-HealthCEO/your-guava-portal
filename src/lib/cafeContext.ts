/**
 * The cafe THIS tab is showing (BE-02-T04, identity-2). sessionStorage is per tab: a switch in another tab cannot move this one,
 * and a reload keeps it. The server checks it against the user's cafes on every refresh and on every request (X-Cafe-Id).
 */
export const TAB_CAFE_STORAGE_KEY = 'yg.tabCafeId'

let memoryCafeId: string | null = null

/** Thrown by refreshAccessToken when the server granted a different cafe from the one this tab asked for. */
export class CafeContextChangedError extends Error {
  readonly cafeId: string | null

  constructor(cafeId: string | null) {
    super('The cafe for this tab changed; reload instead of replaying the request')
    this.name = 'CafeContextChangedError'
    this.cafeId = cafeId
  }
}

export function getTabCafeId(): string | null {
  try {
    const stored = window.sessionStorage.getItem(TAB_CAFE_STORAGE_KEY)
    if (stored) return stored
  } catch {
    // Storage can be unavailable in hardened browser contexts; the in-memory copy still scopes this page load.
  }
  return memoryCafeId
}

export function setTabCafeId(cafeId: string | null): void {
  memoryCafeId = cafeId
  try {
    if (cafeId) window.sessionStorage.setItem(TAB_CAFE_STORAGE_KEY, cafeId)
    else window.sessionStorage.removeItem(TAB_CAFE_STORAGE_KEY)
  } catch {
    // See getTabCafeId.
  }
}

export function clearTabCafeId(): void {
  setTabCafeId(null)
}
