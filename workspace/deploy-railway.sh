#!/bin/bash
set -e

# Contractor Passport - Railway Deployment Script
# This script automates deployment to Railway.app

echo "🚀 Contractor Passport - Railway Deployment"
echo "==========================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
    echo "✅ Railway CLI installed"
else
    echo "✅ Railway CLI found"
fi

# Check if logged in
echo ""
echo "Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "⚠️  Not logged in to Railway. Please login:"
    railway login
fi

echo ""
echo "✅ Authenticated with Railway"
echo ""

# Ask for project name
read -p "Enter project name (default: contractor-passport): " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-contractor-passport}

echo ""
echo "Creating Railway project: $PROJECT_NAME"
echo ""

# Initialize Railway project
railway init --name "$PROJECT_NAME"

echo ""
echo "✅ Railway project created"
echo ""

# Add PostgreSQL
echo "📦 Adding PostgreSQL database..."
railway add --database postgresql

echo ""
echo "✅ PostgreSQL added"
echo ""

# Add Redis
echo "📦 Adding Redis..."
railway add --database redis

echo ""
echo "✅ Redis added"
echo ""

# Generate secrets
echo "🔐 Generating secure secrets..."
OAUTH_STATE_SECRET=$(openssl rand -base64 32)
RSA_PRIVATE_KEY_PASSPHRASE=$(openssl rand -base64 32)

echo ""
echo "✅ Secrets generated"
echo ""

# Ask for OAuth credentials
echo "⚠️  REQUIRED: OAuth Application Credentials"
echo ""
echo "You need to create OAuth apps before continuing:"
echo "  1. GitHub: https://github.com/settings/developers"
echo "  2. LinkedIn: https://www.linkedin.com/developers/"
echo ""
echo "See OAUTH_SETUP.md for detailed instructions"
echo ""

read -p "GitHub Client ID: " GITHUB_CLIENT_ID
read -p "GitHub Client Secret: " GITHUB_CLIENT_SECRET
echo ""

read -p "LinkedIn Client ID: " LINKEDIN_CLIENT_ID
read -p "LinkedIn Client Secret: " LINKEDIN_CLIENT_SECRET
echo ""

read -p "Web Base URL (e.g., https://contractor-passport.vercel.app): " WEB_BASE_URL
echo ""

# Optional: Sentry DSN
read -p "Sentry DSN (optional, press Enter to skip): " SENTRY_DSN
echo ""

# Set environment variables
echo "📝 Setting environment variables..."

railway variables set \
  NODE_ENV=production \
  PORT=3001 \
  OAUTH_STATE_SECRET="$OAUTH_STATE_SECRET" \
  RSA_PRIVATE_KEY_PASSPHRASE="$RSA_PRIVATE_KEY_PASSPHRASE" \
  GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
  GITHUB_REDIRECT_URI="$WEB_BASE_URL/api/oauth/github/callback" \
  LINKEDIN_CLIENT_ID="$LINKEDIN_CLIENT_ID" \
  LINKEDIN_CLIENT_SECRET="$LINKEDIN_CLIENT_SECRET" \
  LINKEDIN_REDIRECT_URI="$WEB_BASE_URL/api/oauth/linkedin/callback" \
  WEB_BASE_URL="$WEB_BASE_URL"

if [ -n "$SENTRY_DSN" ]; then
  railway variables set SENTRY_DSN="$SENTRY_DSN"
fi

echo ""
echo "✅ Environment variables set"
echo ""

# Deploy
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment initiated"
echo ""

# Run migrations
echo "📊 Running database migrations..."
railway run npx prisma migrate deploy --schema=./packages/api/prisma/schema.prisma

echo ""
echo "✅ Migrations complete"
echo ""

# Get deployment URL
RAILWAY_URL=$(railway status --json | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

echo ""
echo "======================================"
echo "✅ DEPLOYMENT SUCCESSFUL"
echo "======================================"
echo ""
echo "API URL: $RAILWAY_URL"
echo "Health Check: $RAILWAY_URL/health"
echo "API Docs: $RAILWAY_URL/api/docs"
echo ""
echo "Next steps:"
echo "  1. Update OAuth callback URLs in GitHub/LinkedIn apps"
echo "  2. Update WEB_BASE_URL if using custom domain"
echo "  3. Test OAuth flows: $RAILWAY_URL/api/oauth/github/start"
echo "  4. Monitor logs: railway logs"
echo ""
echo "🎉 Your Contractor Passport is live!"
