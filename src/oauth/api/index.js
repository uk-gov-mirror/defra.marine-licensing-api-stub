import { postOauthTokenStubController } from './controllers/post-oauth-token-stub.js'

// Drop-in replacement path for MARINE_LICENSING_ADDRESS_LOOKUP_OAUTH_TOKEN_URL
// (https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/token). The tenant-prefixed
// path is accepted too so the local URL can mirror the real one exactly.
export const oauth = [
  {
    method: 'POST',
    path: '/oauth2/v2.0/token',
    ...postOauthTokenStubController
  },
  {
    method: 'POST',
    path: '/{tenantId}/oauth2/v2.0/token',
    ...postOauthTokenStubController
  }
]
