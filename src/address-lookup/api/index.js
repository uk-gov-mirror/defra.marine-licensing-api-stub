import { getAddressLookupStubController } from './controllers/get-address-lookup-stub.js'

// Drop-in replacement path for MARINE_LICENSING_ADDRESS_LOOKUP_API_URL
// (https://dev-api-gateway.azure.defra.cloud/api/address-lookup/v2.1/addresses)
export const addressLookup = [
  {
    method: 'GET',
    path: '/api/address-lookup/v2.1/addresses',
    ...getAddressLookupStubController
  }
]
