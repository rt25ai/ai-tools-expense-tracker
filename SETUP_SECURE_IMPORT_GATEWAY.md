# Secure Manual Import Gateway

This setup removes the need to expose a GitHub token inside the dashboard.

## What it does

- The dashboard parses PDF receipts directly in the browser.
- The browser sends the extracted data and optional PDF to a secure backend endpoint.
- The backend holds the GitHub token in environment variables.
- The backend writes to `manual_receipts.json` and `manual_invoices/`.
- The existing GitHub Actions workflow rebuilds the Excel file and static dashboard.

## Deploy target

Use a Vercel project for the `api/` folder at the repo root.

## Required environment variables

- `MANUAL_IMPORT_GITHUB_OWNER`
- `MANUAL_IMPORT_GITHUB_REPO`
- `MANUAL_IMPORT_GITHUB_BRANCH`
- `MANUAL_IMPORT_GITHUB_TOKEN`
- `MANUAL_IMPORT_ALLOWED_ORIGINS`

## Recommended values

- `MANUAL_IMPORT_GITHUB_OWNER=rt25ai`
- `MANUAL_IMPORT_GITHUB_REPO=ai-tools-expense-tracker`
- `MANUAL_IMPORT_GITHUB_BRANCH=master`
- `MANUAL_IMPORT_ALLOWED_ORIGINS=https://rt25ai.github.io`

If you want to allow local testing too:

- `MANUAL_IMPORT_ALLOWED_ORIGINS=https://rt25ai.github.io,http://127.0.0.1:3000,http://localhost:3000`

## GitHub token

Create a fine-grained token with:

- Repository access: only `ai-tools-expense-tracker`
- Repository permissions: `Contents` -> `Read and write`

Store the token only in the backend environment variable. Do not paste it into the dashboard.

## Dashboard runtime config

After deployment, update:

- `dashboard-web/public/manual-import-config.json`

Set:

```json
{
  "mode": "gateway",
  "gatewayUrl": "https://YOUR-GATEWAY.vercel.app"
}
```

Then rebuild and push the dashboard.

## Health check

Once deployed:

- `GET https://YOUR-GATEWAY.vercel.app/api/health`

Expected result:

```json
{
  "ok": true,
  "mode": "secure-gateway",
  "target": "rt25ai/ai-tools-expense-tracker@master"
}
```
