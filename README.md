# 🚀 Job Automation System

**Intelligent German Job Search & Contact Extraction Platform**

> Automated job discovery from Bundesagentur für Arbeit with robust CAPTCHA handling, cookie consent strategies, contact extraction, and Google Sheets integration.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/) [![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)

## 📋 Contents
- Features
- Quick Start
- Environment Variables
- Google Sheets Setup
- Run & Verify (End-to-End)
- API Reference (curl examples)
- Troubleshooting (CAPTCHA, Cookies, Sheets)

## 🎯 Features
- Bundesagentur für Arbeit job search with filtering (keywords, Ort, Radius, Zeitraum, Beschäftigungsart)
- Robust cookie consent strategies (multi-selector click, double-click, storage flags, forced hide)
- CAPTCHA solving via 2Captcha with retries, reloads, and case-sensitive handling
- Contact extraction priority: email/phone first; fallback to external link only if none found
- Shadow DOM traversal and unicode-aware regex for emails/phones
- Google Sheets integration with graceful disable if misconfigured
- Frontend dashboard with Job Search, Automation, Statistics

## 🚀 Quick Start

### 1) Install
```bash
cd "product pro"
npm run install-all
```

### 2) Configure env
```bash
cp env.example .env
# Edit .env values (see below)
```

Minimal required to run search + enrichment:
- `PORT=3002`
- `TWOCAPTCHA_API_KEY=...`
- For Google Sheets (optional but recommended):
  - `GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets-credentials.json`
  - `GOOGLE_SHEETS_SPREADSHEET_ID=...`
  - `GOOGLE_SHEETS_SHEET_TITLE=Лист1` (or your sheet name)

### 3) Start
```bash
npm run dev
```
- Frontend: http://localhost:3000
- Backend:  http://localhost:3002

## ⚙️ Environment Variables
See `env.example` for a full list. Important ones:
```env
PORT=3002
NODE_ENV=development

# Bundesagentur
BUNDESAGENTUR_API_URL=https://rest.arbeitsagentur.de/jobboerse/jobsuche-service
BUNDESAGENTUR_CLIENT_ID=jobboerse-jobsuche

# 2Captcha
TWOCAPTCHA_API_KEY=your_2captcha_api_key

# Google Sheets
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_google_sheets_id
GOOGLE_SHEETS_SHEET_TITLE=Лист1

# Puppeteer
PUPPETEER_CLOSE_TABS=false
```

## 📑 Google Sheets Setup
1. Create a Service Account (GCP) and enable APIs:
   - Google Sheets API
   - (Added scope) Drive API
2. Download credentials JSON → save to `credentials/google-sheets-credentials.json`
3. Share your spreadsheet with the service account (Editor)
4. Set `GOOGLE_SHEETS_SPREADSHEET_ID` and optional `GOOGLE_SHEETS_SHEET_TITLE`

Backend will auto-resolve first sheet title if not provided and will gracefully disable Sheets if config is missing.

## ✅ Run & Verify (End-to-End)
1) Health check
```bash
curl -s http://localhost:3002/api/health | jq
```

2) Search 1–5 jobs (Berlin, last 30 days) with enrichment
```bash
curl -s -X POST http://localhost:3002/api/jobs/search \
  -H 'Content-Type: application/json' \
  -d '{
    "keywords": "software",
    "location": "Berlin",
    "radius": 50,
    "size": 5,
    "publishedSince": "30"
  }' | jq '.data.jobs | map({title, company, contactEmail, contactPhone, externalUrl})'
```
- Expected: real `contactEmail`/`contactPhone` when possible; else `externalUrl`.

3) Save jobs to Google Sheets (optional)
```bash
curl -s -X POST http://localhost:3002/api/sheets/save-jobs \
  -H 'Content-Type: application/json' \
  -d '{"jobs": [{"id":"test","title":"Test","company":"Test GmbH","location":"Berlin","publishedDate":"2025-08-18"}]}' | jq
```

4) Stats (Sheets)
```bash
curl -s http://localhost:3002/api/sheets/stats | jq
```

## 📡 API Reference (curl)
- Search: `POST /api/jobs/search` (see above)
- Job details: `GET /api/jobs/:id`
- Sheets save: `POST /api/sheets/save-jobs`
- Sheets stats: `GET /api/sheets/stats`
- Automation:
```bash
curl -s -X POST http://localhost:3002/api/automation/run -H 'Content-Type: application/json' -d '{"searchParams":{"keywords":"software","location":"Deutschland"}}' | jq
curl -s http://localhost:3002/api/automation/status | jq
```

## 🧠 CAPTCHA & Cookies: What to expect
- Cookies: multiple strategies including selector variants and double-click; if not visible, scraper proceeds with JS storage flags and forced banner hide.
- CAPTCHA: image-only capture to 2Captcha; case-sensitive; retries up to several cycles; reloads image when umlauts/ß or empty answer; robust submit; waits for contact section to reveal; immediate DOM extraction with Shadow DOM traversal; strict German phone filtering; unicode whitespace normalization.

If email/phone still not found, the system returns `externalUrl` instead (no fake data).

## 🛠️ Troubleshooting
- Sheets “Requested entity was not found”:
  - Check `GOOGLE_SHEETS_SPREADSHEET_ID`, share with service account, correct `GOOGLE_SHEETS_SHEET_TITLE`.
  - Backend logs will say “Google Sheets disabled” if config missing; that’s OK (frontend will still work).

- CAPTCHA not solving:
  - Verify `TWOCAPTCHA_API_KEY` balance.
  - Reduce concurrency (already set to batchSize=1 by default during enrichment in the API route).

- Cookie banner blocks:
  - The scraper attempts multiple selectors and storage flags; try running again or different job if site A/B varies.

- Frontend timeouts/crashes:
  - Long timeout is configured (20 minutes). UI is wrapped in ErrorBoundary to avoid full crash.

## 🧪 Local Dev Tips
- Logs: see `logs/` or console output.
- Update client API base: `client/env.local` → `REACT_APP_API_URL=http://localhost:3002/api`.
- Kill stuck server: `kill -9 $(lsof -ti :3002)`.

