import { health } from '#/routes/health.js'
import { example } from '#/routes/example.js'
import { arcgis } from '#/arcgis/api/index.js'
import { policies } from '#/policies/api/index.js'
import { dynamics } from '#/dynamics/api/index.js'
import { addressLookup } from '#/address-lookup/api/index.js'
import { oauth } from '#/oauth/api/index.js'

export const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([
        health,
        ...example,
        ...arcgis,
        ...policies,
        ...dynamics,
        ...addressLookup,
        ...oauth
      ])
    }
  }
}
