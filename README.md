# marine-licensing-api-stub

Core delivery platform Node.js Backend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Testing](#testing)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [API endpoints](#api-endpoints)
- [Development helpers](#development-helpers)
  - [Proxy](#proxy)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v24` and [npm](https://nodejs.org/) `>= v11`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd marine-licensing-api-stub
nvm use
```

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Testing

To test the application run:

```bash
npm run test
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## API endpoints

| Endpoint                                                           | Description                                   |
| :----------------------------------------------------------------- | :-------------------------------------------- |
| `GET: /health`                                                     | Health                                        |
| `POST: /ArcGIS/rest/services/PolicyData_MDP/FeatureServer/0/<any>` | ArcGIS stub response (accepts any query/body) |
| `GET: /explore-marine-plans/api/policies`                          | GOV.UK policies API stub (5 policies)         |
| `POST: /oauth2/v2.0/token`                                         | Address lookup OAuth token stub               |
| `POST: /<tenantId>/oauth2/v2.0/token`                              | Same, on the tenant-prefixed real path        |
| `GET: /api/address-lookup/v2.1/addresses`                          | DEFRA address lookup stub (requires Bearer)   |
| `POST: /dynamics/oauth2/v2.0/token`                                | Dynamics token stub                           |
| `GET: /dynamics/api/data/v9.2/contacts(<guid>)`                    | Dynamics single contact stub                  |
| `GET: /dynamics/api/data/v9.2/contacts`                            | Dynamics contacts collection stub (`$filter`) |
| `POST: /dynamics/flows/exemptions`                                 | Dynamics exemption submission stub (202)      |
| `POST: /dynamics/flows/exemptions/withdraw`                        | Dynamics exemption withdrawal stub (202)      |
| `POST: /dynamics/flows/exemptions/update`                          | Dynamics exemption update stub (202)          |
| `POST: /dynamics/flows/marine-licences`                            | Dynamics marine licence submission stub (202) |
| `GET: /example    `                                                | Example API (remove as needed)                |
| `GET: /example/<id>`                                               | Example API (remove as needed)                |

### ArcGIS stub endpoint

The ArcGIS stub route is defined using the backend-style API module structure:

- Route index: `src/arcgis/api/index.js`
- Controller: `src/arcgis/api/controllers/post-arcgis-stub.js`

Behaviour:

- Accepts `POST` requests under `/ArcGIS/rest/services/PolicyData_MDP/FeatureServer/0/`
- Accepts any query params and payload on that path
- Returns a fixed ArcGIS-style response with exactly 5 policies in `features`

Example:

```bash
curl -X POST "http://localhost:3001/ArcGIS/rest/services/PolicyData_MDP/FeatureServer/0/query?f=json" \
  -H "content-type: application/json" \
  -d '{"where":"1=1"}'
```

The controller also emits basic ECS-friendly logs for:

- Request received (path/query metadata)
- Response sent (feature count)

### GOV.UK policies stub endpoint

Drop-in replacement for `GOVUK_MARINE_POLICIES_API_URL` when
`https://environment.data.gov.uk/explore-marine-plans/api/policies` is unavailable
or times out.

- Route index: `src/policies/api/index.js`
- Controller: `src/policies/api/controllers/get-policies-stub.js`
- Policy data: `src/policies/data/policies.json`

Behaviour:

- Accepts `GET` requests at `/explore-marine-plans/api/policies`
- Returns a fixed JSON array of the same 5 policies stubbed by the ArcGIS endpoint:
  `E-AGG-3`, `E-MPA-1`, `E-BIO-1`, `E-BIO-2`, `E-CAB-1`
- Response shape matches the live GOV.UK Explore Marine Plans policies API
  (`code`, wording fields, `sector`, etc.)

Point the backend at this stub:

```bash
GOVUK_MARINE_POLICIES_API_URL=http://localhost:3001/explore-marine-plans/api/policies
```

Example:

```bash
curl "http://localhost:3001/explore-marine-plans/api/policies"
```

### OAuth token stub endpoint

The client-credentials token stub for the address lookup gateway:

| Env var                                           | Path                            | Notes                                |
| :------------------------------------------------ | :------------------------------ | :----------------------------------- |
| `MARINE_LICENSING_ADDRESS_LOOKUP_OAUTH_TOKEN_URL` | `/oauth2/v2.0/token`            | Short form                           |
| `MARINE_LICENSING_ADDRESS_LOOKUP_OAUTH_TOKEN_URL` | `/<tenantId>/oauth2/v2.0/token` | Mirrors the real tenant-prefixed URL |

- Controller: `src/oauth/api/controllers/post-oauth-token-stub.js`
- Token minting: `src/oauth/token.js`
- Route index: `src/oauth/api/index.js`

Dynamics has its own token stub on `/dynamics/oauth2/v2.0/token`
(`src/dynamics/api/controllers/post-token-stub.js`) — see the Dynamics sections below. The two are
deliberately kept separate.

Behaviour:

- Accepts `POST` as form-encoded or JSON
- Requires `grant_type=client_credentials` plus a non-empty `client_id` and `client_secret`
  (any values are accepted — this stands in for the gateway's checks, it does not verify them);
  anything else returns `400 {"error":"invalid_request"}`. The client secret is never logged.
- Returns `{ token_type, expires_in, ext_expires_in, access_token }`
- The token's expiry is **encoded in the token itself** rather than stored, so there is no
  server-side state to grow or evict. Tokens are forgeable by design — this is a dev stub, not
  a security boundary.
- `OAUTH_STUB_TOKEN_TTL_SECONDS` (default `3600`, minimum `1`) controls the token lifetime.
  Set it low to drive the consumer's token refresh and 401-retry paths; `0` is rejected at
  startup, since it would mint tokens that are already expired.
- The address lookup endpoint checks the token it is sent; nothing else does.

### Address lookup stub endpoint

Drop-in replacement for `MARINE_LICENSING_ADDRESS_LOOKUP_API_URL`
(`https://dev-api-gateway.azure.defra.cloud/api/address-lookup/v2.1/addresses`).

- Route index: `src/address-lookup/api/index.js`
- Controller: `src/address-lookup/api/controllers/get-address-lookup-stub.js`
- Address data: `src/address-lookup/data/addresses.json`

Behaviour:

- `GET /api/address-lookup/v2.1/addresses?postcode=<postcode>`
- **Requires `Authorization: Bearer <token>`** from the OAuth token stub above; missing,
  malformed, unknown or expired tokens get `401`
- Postcodes are matched case- and whitespace-insensitively
- `NE4 7AR` returns 1 address, `NE1 1EE` returns 3, `NE99 1NC` returns `204 No Content`,
  anything else returns `200` with `results: []`
- `?maxresults=<n>` caps the returned set (default and ceiling 100; a fraction is truncated,
  and anything else unusable falls back to the ceiling). `header.totalResults` stays the **pre-cap** count, which is how the consumer
  detects a truncated set — `?postcode=NE1%201EE&maxresults=2` returns 2 results with
  `totalResults: "3"`.
- Response shape matches the live API (`header` / `results` / `_info`)

Example:

```bash
TOKEN=$(curl -s -X POST "http://localhost:3001/oauth2/v2.0/token" \
  -d 'grant_type=client_credentials&client_id=local-stub-client-id&client_secret=local-stub-client-secret' \
  | jq -r .access_token)

curl "http://localhost:3001/api/address-lookup/v2.1/addresses?postcode=NE4%207AR" \
  -H "Authorization: Bearer $TOKEN"
```

### Dynamics contact details stub endpoints

Stands in for the Dynamics 365 contact details integration, which backs the
"who is the exemption for" value in marine-licensing-backend. There are no Dynamics
credentials or network access locally, so both the OAuth token call and the contacts
lookup are stubbed.

- Route index: `src/dynamics/api/index.js`
- Controllers: `src/dynamics/api/controllers/{post-token-stub,get-contacts-stub}.js`
  (`get-contacts-stub.js` serves both contact routes, branching on whether a contact id
  was given in the path). The Dynamics token stub is separate from the address lookup one —
  see [OAuth token stub endpoint](#oauth-token-stub-endpoint).
- Shared contact resolution: `src/dynamics/helpers/resolve-contact.js`
- Contact data: `src/dynamics/data/contacts.json`

Behaviour:

- `POST /dynamics/oauth2/v2.0/token` issues a fixed access token
  (`src/dynamics/api/controllers/post-token-stub.js`). The contact and flow routes below do not
  check it.
- `GET /dynamics/api/data/v9.2/contacts(<guid>)` returns a single contact entity with
  `fullname` (plus `firstname`, `lastname`, `emailaddress1`). `$select` is ignored.
- `GET /dynamics/api/data/v9.2/contacts?$filter=contactid eq '<guid>' or ...` returns an
  OData collection `{ value: [{ contactid, fullname }] }`, used for batch lookups. With no
  `$filter` it returns every fixture contact.
- The fixture holds the five test users seeded into the local CDP defra-id stub
  (`Sally Self`, `Jason Bourne`, `John Doe`, `John Silver`, and a second `John Doe`), so the
  name shown in the service is the name of the user you logged in as. It mirrors
  `marine-licensing-frontend/compose/users/*.json` — re-sync `src/dynamics/data/contacts.json`
  if those fixtures change.
- Contacts are keyed on the registration's **`contactId`**, which is what the backend stores
  on exemptions and looks up — not the `userId` you type on the stub login page. The `userId`
  is accepted as an alias for convenience; the id that was asked for is echoed back as
  `contactid`.
- Any other valid GUID resolves to a placeholder named after itself
  (`3fa85f64-…` → `Test User 3fa85f64`), so locally seeded contact IDs always return
  something without looking like a real person. A non-GUID id returns a Dynamics-shaped 404.

Point the backend at this stub (see its `.env.template`):

```bash
DYNAMICS_ENABLED=true
DYNAMICS_TOKEN_URL=http://localhost:3001/dynamics/oauth2/v2.0/token
DYNAMICS_API_CONTACT_DETAILS_URL='http://localhost:3001/dynamics/api/data/v9.2/contacts({{contactId}})?$select=fullname'
DYNAMICS_API_CONTACT_DETAILS_BASE_URL=http://localhost:3001/dynamics/api/data/v9.2
```

Example:

```bash
curl "http://localhost:3001/dynamics/api/data/v9.2/contacts(00000000-0000-0000-0000-000000000001)?\$select=fullname"
```

### Dynamics submission flow stub endpoints

Stands in for the Power Automate flows the backend's Dynamics queue poller posts to when an
exemption or marine licence is submitted, withdrawn or updated. Without these, enabling
Dynamics locally means every queued submission retries and lands in the backend's
`exemption-dynamics-queue-failed` collection.

- Route index: `src/dynamics/api/index.js`
- Controller: `src/dynamics/api/controllers/post-submission-stub.js`

Behaviour:

- All four POST routes accept any JSON payload and return **202** with a small
  `{ status, operation, reference }` body. 202 is the only thing the backend checks — it
  discards the response body — and any other status makes it retry.
- Query params are ignored, so the real flow URLs' `api-version` and `sig` are harmless.
- Nothing is validated. The payload shape is owned by the backend's
  `dynamics-client.js`; the stub deliberately does not duplicate it. The contacts
  endpoints are equally forgiving - a `$filter` clause whose id is not a GUID is
  dropped, where real Dynamics would reject the whole query.
- Nothing is stored. Each submission is logged (`dynamics_submission_stub_request`) and
  discarded — check the stub's logs to see what the backend sent.

Point the backend at this stub (see its `.env.template`). Note `DYNAMICS_API_URL` is a
**base** URL — the backend appends `/exemptions` to it:

```bash
DYNAMICS_API_URL=http://localhost:3001/dynamics/flows
DYNAMICS_API_WITHDRAW_URL=http://localhost:3001/dynamics/flows/exemptions/withdraw
DYNAMICS_API_UPDATE_EXEMPTION_URL=http://localhost:3001/dynamics/flows/exemptions/update
DYNAMICS_MARINE_LICENCE_API_URL=http://localhost:3001/dynamics/flows/marine-licences
```

Example:

```bash
curl -i -X POST "http://localhost:3001/dynamics/flows/exemptions" \
  -H 'content-type: application/json' \
  -d '{"reference":"EXE/2025/00099","status":"SUBMITTED"}'
```

## Development helpers

### Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Docker

Build:

```bash
docker build --no-cache --tag marine-licensing-api-stub .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 marine-licensing-api-stub
```

### Docker Compose

A local environment with:

- Floci for AWS services (S3, SQS, SNS etc)
- Redis
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

Mock AWS resources can be created when Floci starts up by editing the scripts in `./compose/floci/start.d/`.

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
