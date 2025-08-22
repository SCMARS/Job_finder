#!/bin/bash

# Job Automation System - Installation Script
# This script will install all dependencies and prepare the project for use

set -e

echo "🚀 Job Automation System - Installation Script"
echo "================================================"

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
echo "=============================="

# Backend dependencies
echo "Installing backend dependencies..."
npm install

# Frontend dependencies
echo "Installing frontend dependencies..."
cd client && npm install && cd ..

echo "✅ Dependencies installed successfully"

# Setup environment
echo ""
echo "⚙️  Setting up environment..."
echo "=============================="

if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file and add your API keys:"
    echo "   - TWOCAPTCHA_API_KEY (required for CAPTCHA solving)"
    echo "   - GOOGLE_SHEETS_* (optional, for saving results)"
    echo "   - APOLLO_API_KEY (optional, for contact enrichment)"
else
    echo "✅ .env file already exists"
fi

# Create credentials directory
if [ ! -d credentials ]; then
    mkdir -p credentials
    echo "✅ Created credentials directory"
else
    echo "✅ Credentials directory already exists"
fi

# Create logs directory
if [ ! -d logs ]; then
    mkdir -p logs
    echo "✅ Created logs directory"
else
    echo "✅ Logs directory already exists"
fi

# Check TypeScript config
if [ ! -f client/tsconfig.json ]; then
    echo "Creating TypeScript config for client..."
    cat > client/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": [
      "dom",
      "dom.iterable",
      "es6"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": [
    "src"
  ]
}
EOF
    echo "✅ TypeScript config created"
else
    echo "✅ TypeScript config already exists"
fi

echo ""
echo "🎉 Installation completed successfully!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your API keys:"
echo "   nano .env"
echo ""
echo "2. Start the application:"
echo "   npm run dev"
echo ""
echo "3. Open your browser:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3002"
echo ""
echo "For more information, read README.md"
echo "" 