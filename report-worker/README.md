# Hypertune report relay (Cloudflare Worker)

Files a GitHub issue for every "Report a problem" submission from the app.

The app can't hold a GitHub token (anyone can unpack the build and read it), so
it POSTs the report here and this Worker files the issue using a token kept as a
server-side secret.

Reports land as issues on a **private** repository (`AJJBB/hypertune-reports`).
Each payload can include a user's contact email, Discord ID, and device details,
so the target repo must be private — never point this at the public source repo.

## One-time setup

**1. Create a fine-grained GitHub token**
- github.com → Settings → Developer settings → Fine-grained tokens → Generate new token
- Repository access → Only select repositories → `AJJBB/hypertune-reports` (private)
- Permissions → Repository permissions → **Issues: Read and write**
- Generate and copy the token.

**2. Deploy the Worker** (needs Node, then `npm i -g wrangler`)
```bash
cd report-worker
wrangler login
wrangler deploy
```
Wrangler prints the URL, e.g. `https://hypertune-report.<your-subdomain>.workers.dev`.

**3. Add the secrets**
```bash
wrangler secret put GITHUB_TOKEN     # paste the token from step 1
wrangler secret put APP_SECRET       # optional: any random string (anti-spam)
```

**4. Point the app at the Worker**
Set these when building the app (`.env` in `app/`, or your CI env):
```
VITE_REPORT_ENDPOINT=https://hypertune-report.<your-subdomain>.workers.dev
VITE_REPORT_KEY=<same value you used for APP_SECRET, if you set one>
```
Or just edit `REPORT_ENDPOINT` at the top of `app/src/app/ReportProblemDialog.tsx`.

## Test
```bash
curl -X POST https://hypertune-report.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"category":"Test","deviceName":"Test mouse","description":"hello from curl"}'
```
A new issue tagged `app-report` should appear in the repo, and the response is
`{"ok":true,"url":"...","number":N}`.

## Payload the app sends
```json
{
  "category": "Mouse not detected",
  "description": "free text from the user",
  "contact": "optional email",
  "discordId": "optional Discord ID",
  "otherSoftware": "optional: other mouse software running",
  "deviceName": "active mouse name or (none connected)",
  "appVersion": "STABLE · v2.0.0",
  "platform": "navigator.userAgent",
  "deviceDump": "the same text as the Copy device info button"
}
```
