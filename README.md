# Job Automation System

Intelligent German Job Search & Contact Extraction Platform

Automated job discovery from Bundesagentur für Arbeit with robust CAPTCHA handling, cookie consent strategies, contact extraction, and Google Sheets integration.

## Features

- Bundesagentur für Arbeit job search with filtering (keywords, location, radius, time period, employment type)
- Robust cookie consent strategies with multiple fallback methods
- CAPTCHA solving via 2Captcha API
- Contact extraction priority: real email/phone first, external link as fallback
- Google Sheets integration for data storage
- Frontend dashboard with Job Search, Automation, and Statistics
- Web scraping with Puppeteer for advanced contact extraction

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Cloud Platform account (for Google Sheets integration)
- 2Captcha API key

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/SCMARS/Job_finder.git
cd Job_finder
```

### 2. Install dependencies
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Environment configuration
```bash
# Copy environment template
cp env.example .env

# Edit .env file with your configuration
nano .env
```

**Required environment variables:**
```env
PORT=3002
TWOCAPTCHA_API_KEY=your_2captcha_api_key

# Optional but recommended for full functionality:
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets-credentials.json
GOOGLE_SHEETS_SPREADSHET_ID=your_spreadsheet_id
GOOGLE_SHEETS_SHEET_TITLE=Sheet1
```

### 4. Google Sheets Setup (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API and Google Drive API
4. Create a Service Account
5. Download the JSON credentials file
6. Save it to `credentials/google-sheets-credentials.json`
7. Share your Google Spreadsheet with the service account email (Editor access)

## Running the Project

### Development Mode (Recommended)
```bash
# Start both backend and frontend simultaneously
npm run dev
```

This will start:
- Backend server on port 3002
- Frontend React app on port 3000

### Manual Start
```bash
# Terminal 1 - Start backend
npm run server

# Terminal 2 - Start frontend
npm run client
```

### Production Build
```bash
# Build frontend
cd client
npm run build
cd ..

# Start production server
npm start
```

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3002/api
- **Health Check**: http://localhost:3002/api/health

## Project Structure

```
Job_finder/
├── server/                 # Backend Node.js/Express
│   ├── index.js           # Main server entry point
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   └── utils/             # Utilities and logging
├── client/                # Frontend React app
│   ├── src/               # Source code
│   ├── public/            # Static files
│   └── package.json       # Frontend dependencies
├── credentials/            # API credentials (create this folder)
├── logs/                  # Application logs
└── package.json           # Root dependencies
```

## Usage

### 1. Job Search
- Open http://localhost:3000
- Use the Job Search tab
- Enter keywords (use German terms for better results)
- Set location and search radius
- Click "Search Jobs"

### 2. Automation
- Use the Automation tab to schedule automated job searches
- Set up recurring searches with custom parameters
- Monitor automation status and results

### 3. Statistics
- View job pipeline statistics
- Monitor enrichment success rates
- Track automation performance

## Troubleshooting

### Port Already in Use
```bash
# Kill process using port 3002
lsof -ti:3002 | xargs kill -9

# Or use a different port in .env
PORT=3003
```

### Frontend Build Issues
```bash
# Clear node_modules and reinstall
cd client
rm -rf node_modules package-lock.json
npm install
```

### Missing Files Error
If you get "Could not find a required file: index.html":
```bash
# Ensure you're in the correct directory
pwd
# Should show: /path/to/Job_finder

# Check if public folder exists
ls -la client/public/
# Should contain: index.html, manifest.json, favicon.ico
```

### Google Sheets Issues
- Verify credentials file path in .env
- Check if spreadsheet is shared with service account
- Ensure Google Sheets API is enabled

## API Examples

### Search Jobs
```bash
curl -X POST http://localhost:3002/api/jobs/search \
  -H 'Content-Type: application/json' \
  -d '{
    "keywords": "software",
    "location": "Berlin",
    "radius": 50,
    "size": 10,
    "publishedSince": "30"
  }'
```

### Check Automation Status
```bash
curl http://localhost:3002/api/automation/status
```

### Health Check
```bash
curl http://localhost:3002/api/health
```

## Development

### Adding New Features
1. Backend: Add routes in `server/routes/`
2. Frontend: Add components in `client/src/components/`
3. Services: Add business logic in `server/services/`

### Logging
- Backend logs: Check console output or `logs/` directory
- Frontend logs: Check browser console

### Testing
```bash
# Backend tests
npm test

# Frontend tests
cd client
npm test
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review server logs for error details
3. Verify environment configuration
4. Check if all required services are running

## License

This project is proprietary software. All rights reserved.

