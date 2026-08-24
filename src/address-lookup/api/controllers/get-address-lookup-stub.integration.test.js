describe('GET Address Lookup Stub Endpoint', () => {
  let server
  let accessToken
  let configuredTtlSeconds

  const SUITE_TTL_SECONDS = 3600

  const requestAccessToken = async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/oauth2/v2.0/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'local-stub-client-id',
        client_secret: 'local-stub-client-secret'
      }).toString()
    })

    return JSON.parse(response.payload).access_token
  }

  const lookup = (postcode, headers = {}, query = {}) => {
    const search = new URLSearchParams({ postcode, ...query })

    return server.inject({
      method: 'GET',
      url: `/api/address-lookup/v2.1/addresses?${search}`,
      headers: { authorization: `Bearer ${accessToken}`, ...headers }
    })
  }

  beforeAll(async () => {
    const { config } = await import('#/config.js')
    const { createServer } = await import('#/server.js')

    // One token is minted here and reused throughout, so pin the lifetime for the suite —
    // a low OAUTH_STUB_TOKEN_TTL_SECONDS locally would otherwise expire it part-way through
    configuredTtlSeconds = config.get('oauthStub.tokenTtlSeconds')
    config.set('oauthStub.tokenTtlSeconds', SUITE_TTL_SECONDS)

    server = await createServer()
    await server.initialize()
    accessToken = await requestAccessToken()
  })

  afterAll(async () => {
    const { config } = await import('#/config.js')
    config.set('oauthStub.tokenTtlSeconds', configuredTtlSeconds)

    await server?.stop({ timeout: 1000 })
  })

  test('returns the address for the known test postcode in the real API response shape', async () => {
    const response = await lookup('NE4 7AR')

    expect(response.statusCode).toBe(200)

    const payload = JSON.parse(response.payload)

    expect(payload.header).toEqual(
      expect.objectContaining({
        query: 'postcode=NE4 7AR',
        totalResults: '1',
        matchingTotalResults: '1',
        format: 'JSON',
        dataset: 'DPA'
      })
    )
    expect(payload._info).toEqual(
      expect.objectContaining({
        service: 'Address Lookup v2',
        method: 'GET',
        url: '/api/address-lookup/v2.1/addresses'
      })
    )
    expect(payload.results).toHaveLength(1)
    expect(payload.results[0]).toEqual(
      expect.objectContaining({
        buildingName: 'TYNESIDE HOUSE',
        postcode: 'NE4 7AR',
        uprn: '4510116883'
      })
    )
  })

  test.each(['ne4 7ar', 'NE47AR', '  ne4   7ar '])(
    'matches postcode "%s" regardless of case and whitespace',
    async (postcode) => {
      const response = await lookup(postcode)

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload).results).toHaveLength(1)
    }
  )

  test('returns many results for a multi-address postcode', async () => {
    const response = await lookup('NE1 1EE')

    expect(response.statusCode).toBe(200)

    const payload = JSON.parse(response.payload)

    expect(payload.results).toHaveLength(3)
    expect(payload.header.totalResults).toBe('3')
  })

  // The consumer compares header.totalResults against results.length to tell that the set
  // was capped, so the total has to stay the pre-cap count
  test('reports the full total when maxresults truncates the set', async () => {
    const response = await lookup('NE1 1EE', {}, { maxresults: '2' })

    expect(response.statusCode).toBe(200)

    const payload = JSON.parse(response.payload)

    expect(payload.results).toHaveLength(2)
    expect(payload.header.totalResults).toBe('3')
    expect(payload.header.maximumResults).toBe('2')
  })

  test.each([
    ['above the stub ceiling', '500'],
    ['not a number', 'all'],
    ['zero', '0']
  ])(
    'caps maxresults at the stub ceiling when it is %s',
    async (_description, maxresults) => {
      const response = await lookup('NE1 1EE', {}, { maxresults })

      expect(response.statusCode).toBe(200)

      const payload = JSON.parse(response.payload)

      expect(payload.results).toHaveLength(3)
      expect(payload.header.maximumResults).toBe('100')
    }
  )

  test('returns zero results for an unknown postcode', async () => {
    const response = await lookup('ZZ1 1ZZ')

    expect(response.statusCode).toBe(200)

    const payload = JSON.parse(response.payload)

    expect(payload.results).toEqual([])
    expect(payload.header.totalResults).toBe('0')
  })

  test('uses the first value when the postcode is supplied more than once', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/address-lookup/v2.1/addresses?postcode=NE4%207AR&postcode=NE1%201EE',
      headers: { authorization: `Bearer ${accessToken}` }
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).results).toHaveLength(1)
  })

  test('returns zero results when no postcode is supplied', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/address-lookup/v2.1/addresses',
      headers: { authorization: `Bearer ${accessToken}` }
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).results).toEqual([])
  })

  test('returns 204 No Content for the reserved no-content postcode', async () => {
    const response = await lookup('NE99 1NC')

    expect(response.statusCode).toBe(204)
    expect(response.payload).toBe('')
  })

  describe('authorization', () => {
    test('rejects a request with no Authorization header', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/address-lookup/v2.1/addresses?postcode=NE4%207AR'
      })

      expect(response.statusCode).toBe(401)
    })

    test.each([
      ['a non-Bearer scheme', 'Basic abc123'],
      ['an empty Bearer token', 'Bearer '],
      ['an unrecognised token', 'Bearer not-a-real-token']
    ])('rejects %s with 401', async (_description, authorization) => {
      const response = await lookup('NE4 7AR', { authorization })

      expect(response.statusCode).toBe(401)
    })

    // The auth-scheme is case-insensitive per RFC 7235
    test.each(['bearer', 'BEARER', 'BeArEr'])(
      'accepts the "%s" scheme spelling',
      async (scheme) => {
        const response = await lookup('NE4 7AR', {
          authorization: `${scheme} ${accessToken}`
        })

        expect(response.statusCode).toBe(200)
      }
    )
  })
})
