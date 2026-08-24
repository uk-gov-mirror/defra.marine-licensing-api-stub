describe('POST OAuth Token Stub Endpoint', () => {
  let server

  const validPayload = {
    grant_type: 'client_credentials',
    client_id: 'local-stub-client-id',
    client_secret: 'local-stub-client-secret',
    scope: 'api://stub/.default',
    redirect_uri: 'http://localhost:3000'
  }

  const requestToken = (payload, url = '/oauth2/v2.0/token') =>
    server.inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(payload).toString()
    })

  beforeAll(async () => {
    const { createServer } = await import('#/server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 1000 })
  })

  test('issues an access token for a valid client credentials request', async () => {
    const response = await requestToken(validPayload)

    expect(response.statusCode).toBe(200)

    const payload = JSON.parse(response.payload)

    expect(payload.token_type).toBe('Bearer')
    expect(payload.expires_in).toBeGreaterThan(0)
    // Real Entra ID returns ext_expires_in alongside expires_in
    expect(payload.ext_expires_in).toBe(payload.expires_in)
    expect(payload.access_token).toEqual(expect.any(String))
    expect(payload.access_token.length).toBeGreaterThan(0)
  })

  test('serves the tenant-prefixed path used by the real token endpoint', async () => {
    const response = await requestToken(
      validPayload,
      '/9fb17f24-fe6d-4c1e-9a7f-1f9c9a4a2b3d/oauth2/v2.0/token'
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual(
      expect.objectContaining({
        token_type: 'Bearer',
        access_token: expect.any(String)
      })
    )
  })

  test('accepts a JSON body as well as form encoding', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/oauth2/v2.0/token',
      headers: { 'content-type': 'application/json' },
      payload: validPayload
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).access_token).toEqual(
      expect.any(String)
    )
  })

  test.each([
    ['an unsupported grant type', { ...validPayload, grant_type: 'password' }],
    ['a missing grant type', { ...validPayload, grant_type: '' }],
    ['a missing client id', { ...validPayload, client_id: '' }],
    ['a missing client secret', { ...validPayload, client_secret: '' }]
  ])('rejects %s with 400 invalid_request', async (_description, payload) => {
    const response = await requestToken(payload)

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.payload).error).toBe('invalid_request')
  })

  test('rejects a request with no payload at all', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/oauth2/v2.0/token'
    })

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.payload).error).toBe('invalid_request')
  })
})
