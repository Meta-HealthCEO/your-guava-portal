import { afterEach, describe, expect, it, vi } from 'vitest'
import { secureRandomId } from './idempotency'

describe('secureRandomId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'secure-uuid' })
    expect(secureRandomId()).toBe('secure-uuid')
  })

  it('uses getRandomValues when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab)
        return bytes
      },
    })
    expect(secureRandomId()).toBe('ab'.repeat(16))
  })

  it('fails closed without a secure browser generator', () => {
    vi.stubGlobal('crypto', undefined)
    expect(() => secureRandomId()).toThrow(/secure random/i)
  })
})
