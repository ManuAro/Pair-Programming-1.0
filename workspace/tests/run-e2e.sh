#!/bin/bash

# E2E Test Runner for Contractor Passport
# This script starts the API server, runs E2E tests, and cleans up

set -e

echo "🚀 Starting E2E Test Suite"
echo "=========================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_DIR="../packages/api"
TEST_DIR="."
API_PORT=3001
API_PID_FILE="/tmp/contractor-passport-test-api.pid"

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"

  if [ -f "$API_PID_FILE" ]; then
    API_PID=$(cat "$API_PID_FILE")
    if ps -p $API_PID > /dev/null 2>&1; then
      echo "Stopping API server (PID: $API_PID)"
      kill $API_PID || true
      sleep 2
      # Force kill if still running
      if ps -p $API_PID > /dev/null 2>&1; then
        kill -9 $API_PID || true
      fi
    fi
    rm -f "$API_PID_FILE"
  fi

  echo -e "${GREEN}Cleanup complete${NC}"
}

# Register cleanup on script exit
trap cleanup EXIT INT TERM

# Check if API server is already running
if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo -e "${YELLOW}⚠️  API server already running on port $API_PORT${NC}"
  echo "Using existing server..."
else
  echo "📦 Starting API server..."

  cd "$API_DIR"

  # Install dependencies if needed
  if [ ! -d "node_modules" ]; then
    echo "Installing API dependencies..."
    npm install
  fi

  # Run database migrations
  echo "Running database migrations..."
  npx prisma generate
  npx prisma db push

  # Start API server in background
  npm run dev > /tmp/contractor-passport-test-api.log 2>&1 &
  API_PID=$!
  echo $API_PID > "$API_PID_FILE"

  echo "API server started (PID: $API_PID)"

  # Wait for API to be ready
  echo "Waiting for API to be ready..."
  MAX_ATTEMPTS=30
  ATTEMPT=0

  while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
      echo -e "${GREEN}✓ API server is ready${NC}"
      break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -n "."
    sleep 1
  done

  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}✗ API server failed to start${NC}"
    echo "Logs:"
    cat /tmp/contractor-passport-test-api.log
    exit 1
  fi

  cd - > /dev/null
fi

# Install test dependencies
echo -e "\n📦 Installing test dependencies..."
if [ ! -d "../node_modules" ]; then
  cd ..
  npm install --save-dev jest @jest/globals @types/jest ts-jest axios @types/axios
  cd tests
fi

# Run tests
echo -e "\n🧪 Running E2E tests...\n"

cd ..

# Create jest config if it doesn't exist
if [ ! -f "jest.config.js" ]; then
  cat > jest.config.js <<'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['packages/api/src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  verbose: true,
};
EOF
fi

# Run Jest
npx jest tests/e2e.test.ts --verbose --forceExit

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}\n"
else
  echo -e "\n${RED}❌ Some tests failed${NC}\n"
  exit $TEST_EXIT_CODE
fi
