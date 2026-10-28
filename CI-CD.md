# Tests and automatic deployment

Every push and pull request runs locked dependency installation, type checking, a production build,
tests, runtime packaging and an isolated package smoke check. A passing push to `main` then deploys
the same checked ZIP to [D-Fence](https://dfence-sc2006.azurewebsites.net). Other branches and pull
requests do not deploy. A manual Actions run deploys only when run against `main`.

The workflow is [deploy.yml](.github/workflows/deploy.yml). Production deployments run one at a
time. An active deployment is not cancelled by another push.

## Credentials

Never commit `.env`, `.env.*`, publish profiles or production keys. The workflow rejects tracked
environment files, except explicit `.example` templates. Runtime database, image-provider, OneMap,
storage and Telegram credentials stay in Azure App Settings. Tests use
`DFENCE_TEST_LIVE_DB=false` and an empty `DATABASE_URL`; they do not connect to production services.
The repository integration suite is therefore skipped in CI rather than writing to the live database.

Local `npm test` also skips database integration tests unless `DFENCE_TEST_LIVE_DB` is exactly
`true`, even when local configuration contains a database URL. The integration suite writes and
replaces data, clears source metadata, and retains append-only audit fixtures. Run it only against
an isolated disposable PostGIS database. To opt in explicitly from PowerShell:

```powershell
$env:DATABASE_URL = '<isolated disposable PostGIS connection string>'
$env:DFENCE_TEST_LIVE_DB = 'true'
try { npx vitest run tests/repository.test.ts }
finally { Remove-Item Env:DFENCE_TEST_LIVE_DB }
```

Keep the CI setting `DFENCE_TEST_LIVE_DB=false`.


The deploy job reads these encrypted **repository Actions secrets**:

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | The deployment identity's client ID |
| `AZURE_TENANT_ID` | Its Microsoft Entra tenant |
| `AZURE_SUBSCRIPTION_ID` | The existing Azure subscription |

Azure uses GitHub OpenID Connect (OIDC), which exchanges a short-lived GitHub token for Azure
access. There is no publish-profile password or Azure client secret. The federated credential must
use issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`
and the exact subject GitHub issues for this repository:
`repo:Dung-CS@180244362/SC2006@1349297134:ref:refs/heads/main`.
This repository's token includes immutable owner and repository IDs; the legacy name-only subject
does not match. The first live workflow exposed that mismatch, which is corrected in Azure.
Assign the identity Website Contributor on
the `dfence-sc2006` app, not the whole subscription. The workflow has no GitHub environment binding,
because that would change the OIDC subject. Only the deploy job can request an identity token.

## Release checks

`tools/package-release.mjs` copies installed production dependencies into an isolated staging
folder. It includes the server, built client and assets, public database CA certificate, two public
configuration JSON files and a runtime `package.json`. It excludes environment files, logs, source
maps, private-key file types and development tools. It leaves the development installation intact.
Python 3's standard ZIP library creates forward-slash paths and checks CRCs. No ZIP dependency is
installed. Both Node 24 and Python 3 are available on the Ubuntu GitHub runner.

The release manifest records the commit and SHA256 hashes of the ZIP, server, client and every
packaged file. The ZIP is limited to 60 MiB, which accommodates the current approximately 22 MB
runtime including image assets. The deploy job downloads the build job's immutable artifact ID,
checks its expected hash and file inventory, then deploys it. It does not rebuild from a moving branch.

`tools/smoke-release.mjs` boots a fresh extraction with memory stores and outbound HTTP blocked.
It checks health, manager sign-in, the route API and the browser shell. Populated dispatch behaviour
is covered by the normal tests; this smoke check does not claim production database or provider access.

After deployment, the workflow restarts the app, allows up to five minutes for live health, and
checks the deployed server's SHA256 through Kudu against the tested build. It fails if the package
was accepted but the app does not become healthy or the deployed file differs.

## Local package check

From the project folder:

```powershell
npm ci
npm run typecheck
npm run build
$env:DFENCE_TEST_LIVE_DB = 'false'
npm test
node tools/package-release.mjs
node tools/smoke-release.mjs
```

Generated files stay under `scratchpad/ci-release/`, which is ignored by Git. No deployment occurs
from these local commands. Inspect the repository's Actions tab for check and deployment results.
An Azure deployment is not complete merely because GitHub accepted a push.

Action versions were checked against the official repositories and pinned to commit hashes:
[checkout](https://github.com/actions/checkout/releases/tag/v7.0.1),
[setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0),
[upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2),
[download-artifact](https://github.com/actions/download-artifact/releases/tag/v8.0.2),
[Azure Login](https://github.com/Azure/login/releases/tag/v3.1.0) and
[Web Apps Deploy](https://github.com/Azure/webapps-deploy/tree/v3).
