import Boom from '@hapi/boom'
import { structureErrorForECS } from '#/common/helpers/logging/logger.js'
import { mintToken } from '#/oauth/token.js'

const GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials'
const HTTP_STATUS_BAD_REQUEST = 400

// Stricter than it needs to be, deliberately. The values themselves are never checked, but a
// missing client id or secret locally almost always means a misconfigured env var, and failing
// loudly here is far cheaper to diagnose than a 401 three layers downstream.
const isValidTokenRequest = (payload) =>
  payload.grant_type === GRANT_TYPE_CLIENT_CREDENTIALS &&
  Boolean(payload.client_id) &&
  Boolean(payload.client_secret)

// Serves the address lookup gateway's token URL (`/oauth2/v2.0/token`, with and without the
// real tenant prefix). Dynamics has its own token stub at src/dynamics/ — deliberately left
// alone, since it is already merged and used by another team.
export const postOauthTokenStubController = {
  options: {
    auth: false,
    payload: {
      parse: true,
      output: 'data',
      // text/plain is deliberately not allowed: hapi would hand the body through as a
      // string, so the credential check below could never pass
      allow: ['application/x-www-form-urlencoded', 'application/json']
    }
  },
  handler: async (request, h) => {
    try {
      const payload = request.payload ?? {}

      if (!isValidTokenRequest(payload)) {
        request.logger.info(
          {
            event: {
              action: 'oauth_token_stub_rejected',
              category: 'authentication',
              type: 'access',
              outcome: 'failure'
            },
            url: { path: request.path }
          },
          'OAuth token stub rejected an invalid token request'
        )

        return h
          .response({
            error: 'invalid_request',
            error_description:
              'Expected grant_type=client_credentials with client_id and client_secret'
          })
          .code(HTTP_STATUS_BAD_REQUEST)
      }

      const { accessToken, expiresIn } = mintToken()

      // The client secret is deliberately never logged
      request.logger.info(
        {
          event: {
            action: 'oauth_token_stub_issued',
            category: 'authentication',
            type: 'access',
            outcome: 'success'
          },
          url: { path: request.path }
        },
        `OAuth token stub issued an access token for client ${payload.client_id}`
      )

      return h.response({
        token_type: 'Bearer',
        expires_in: expiresIn,
        // Real Entra ID returns both
        ext_expires_in: expiresIn,
        access_token: accessToken
      })
    } catch (error) {
      request.logger.error(
        structureErrorForECS(error),
        'Failed to return OAuth token stub response'
      )
      throw Boom.internal('Failed to return OAuth token stub response')
    }
  }
}
