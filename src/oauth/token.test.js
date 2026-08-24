import { config } from '#/config.js'
import { mintToken, isTokenValid } from '#/oauth/token.js'

describe('#token', () => {
  // Captured rather than hardcoded: OAUTH_STUB_TOKEN_TTL_SECONDS may be set locally, and
  // config is a process-wide singleton, so restoring the wrong value leaks into other suites
  let configuredTtlSeconds

  beforeAll(() => {
    configuredTtlSeconds = config.get('oauthStub.tokenTtlSeconds')
  })

  afterEach(() => {
    vi.useRealTimers()
    config.set('oauthStub.tokenTtlSeconds', configuredTtlSeconds)
  })

  test('a freshly minted token is valid', () => {
    const { accessToken, expiresIn } = mintToken()

    expect(expiresIn).toBe(configuredTtlSeconds)
    expect(isTokenValid(accessToken)).toBe(true)
  })

  test('mints a distinct token each time', () => {
    expect(mintToken().accessToken).not.toBe(mintToken().accessToken)
  })

  test('a token stops being valid once its lifetime has elapsed', () => {
    vi.useFakeTimers()
    config.set('oauthStub.tokenTtlSeconds', 5)

    const { accessToken, expiresIn } = mintToken()

    // The consumer caches on expires_in, so the advertised lifetime has to track the config
    expect(expiresIn).toBe(5)
    expect(isTokenValid(accessToken)).toBe(true)

    vi.advanceTimersByTime(5001)

    expect(isTokenValid(accessToken)).toBe(false)
  })

  test.each([
    ['an unknown token', 'not-a-real-token'],
    ['an empty token', ''],
    ['a token with an expiry that is not a number', 'later.abc123'],
    ['a token with an expiry in the past', '1.abc123'],
    ['no token at all', undefined]
  ])('%s is not valid', (_description, accessToken) => {
    expect(isTokenValid(accessToken)).toBe(false)
  })
})
