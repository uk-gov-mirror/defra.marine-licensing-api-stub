import { randomUUID } from 'node:crypto'
import { config } from '#/config.js'

const MILLISECONDS_PER_SECOND = 1000

// The expiry is encoded in the token itself rather than held in a server-side store, so
// there is nothing to grow, evict or reset between tests. Tokens are trivially forgeable —
// this is a local stub, not a security boundary.
export const mintToken = () => {
  const expiresIn = config.get('oauthStub.tokenTtlSeconds')
  const expiresAt = Date.now() + expiresIn * MILLISECONDS_PER_SECOND

  return {
    accessToken: `${expiresAt}.${randomUUID().replaceAll('-', '')}`,
    expiresIn
  }
}

// Unknown or malformed tokens parse to NaN, and every comparison with NaN is false.
export const isTokenValid = (accessToken = '') =>
  Date.now() < Number(accessToken.split('.')[0])
