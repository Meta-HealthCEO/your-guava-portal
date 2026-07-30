const RANDOM_BYTES = 16

export function secureRandomId(): string {
  const crypto = globalThis.crypto
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto?.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is unavailable')
  }

  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_BYTES))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
