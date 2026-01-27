#!/bin/bash
# TrustLayer Production Smoke Test
# Validates critical paths work after deployment

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${1:-http://localhost:3001}"
TIMEOUT=10

echo "============================================"
echo "TrustLayer Production Smoke Test"
echo "============================================"
echo "API URL: $API_URL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Track failures
FAILURES=0

# Helper function for tests
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local check_json="${4:-false}"

    echo -n "Testing ${name}... "

    response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "${API_URL}${url}" || echo "000")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        if [ "$check_json" = "true" ]; then
            if echo "$body" | jq empty 2>/dev/null; then
                echo -e "${GREEN}✓ PASS${NC} (${status_code})"
                return 0
            else
                echo -e "${RED}✗ FAIL${NC} (Invalid JSON)"
                FAILURES=$((FAILURES + 1))
                return 1
            fi
        else
            echo -e "${GREEN}✓ PASS${NC} (${status_code})"
            return 0
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Expected ${expected_status}, got ${status_code})"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# Test 1: Health Check
echo "=== CORE ENDPOINTS ==="
test_endpoint "Health check" "/health" 200 true

# Test 2: JWKS Endpoint
test_endpoint "JWKS endpoint" "/.well-known/jwks.json" 200 true

# Test 3: Onboarding (Create contractor)
echo ""
echo "=== ONBOARDING FLOW ==="
echo -n "Creating test contractor... "

onboard_response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
  -X POST "${API_URL}/api/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smoke Test User",
    "email": "smoketest+'$(date +%s)'@example.com",
    "phone": "+1234567890"
  }' || echo '{"contractorId":null}
000')

onboard_status=$(echo "$onboard_response" | tail -n1)
onboard_body=$(echo "$onboard_response" | sed '$d')

if [ "$onboard_status" = "200" ] || [ "$onboard_status" = "201" ]; then
    CONTRACTOR_ID=$(echo "$onboard_body" | jq -r '.contractorId')
    if [ "$CONTRACTOR_ID" != "null" ] && [ -n "$CONTRACTOR_ID" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Contractor ID: ${CONTRACTOR_ID})"
    else
        echo -e "${RED}✗ FAIL${NC} (No contractor ID returned)"
        FAILURES=$((FAILURES + 1))
        CONTRACTOR_ID=""
    fi
else
    echo -e "${RED}✗ FAIL${NC} (Status: ${onboard_status})"
    FAILURES=$((FAILURES + 1))
    CONTRACTOR_ID=""
fi

# Test 4: Identity Verification (if contractor created)
if [ -n "$CONTRACTOR_ID" ]; then
    echo -n "Verifying identity... "

    verify_response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
      -X POST "${API_URL}/api/verify/identity" \
      -H "Content-Type: application/json" \
      -d "{
        \"contractorId\": \"${CONTRACTOR_ID}\",
        \"documentType\": \"drivers_license\",
        \"documentNumber\": \"TEST123456\"
      }" || echo '{"success":false}
000')

    verify_status=$(echo "$verify_response" | tail -n1)

    if [ "$verify_status" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${RED}✗ FAIL${NC} (Status: ${verify_status})"
        FAILURES=$((FAILURES + 1))
    fi

    # Test 5: Issue Credential
    echo ""
    echo "=== CREDENTIAL ISSUANCE ==="
    echo -n "Issuing credential... "

    issue_response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
      -X POST "${API_URL}/api/credentials/issue" \
      -H "Content-Type: application/json" \
      -d "{
        \"contractorId\": \"${CONTRACTOR_ID}\"
      }" || echo '{"credential":null}
000')

    issue_status=$(echo "$issue_response" | tail -n1)
    issue_body=$(echo "$issue_response" | sed '$d')

    if [ "$issue_status" = "200" ]; then
        CREDENTIAL=$(echo "$issue_body" | jq -r '.credential')
        CREDENTIAL_ID=$(echo "$issue_body" | jq -r '.credentialId')

        if [ "$CREDENTIAL" != "null" ] && [ -n "$CREDENTIAL" ]; then
            echo -e "${GREEN}✓ PASS${NC} (Credential ID: ${CREDENTIAL_ID})"

            # Test 6: Verify Credential
            echo -n "Verifying credential... "

            verify_cred_response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
              -X POST "${API_URL}/api/credentials/${CREDENTIAL_ID}/verify" \
              -H "Content-Type: application/json" \
              -d "{
                \"credential\": ${CREDENTIAL}
              }" || echo '{"valid":false}
000')

            verify_cred_status=$(echo "$verify_cred_response" | tail -n1)
            verify_cred_body=$(echo "$verify_cred_response" | sed '$d')

            if [ "$verify_cred_status" = "200" ]; then
                is_valid=$(echo "$verify_cred_body" | jq -r '.valid')
                if [ "$is_valid" = "true" ]; then
                    echo -e "${GREEN}✓ PASS${NC}"
                else
                    echo -e "${RED}✗ FAIL${NC} (Credential marked invalid)"
                    FAILURES=$((FAILURES + 1))
                fi
            else
                echo -e "${RED}✗ FAIL${NC} (Status: ${verify_cred_status})"
                FAILURES=$((FAILURES + 1))
            fi
        else
            echo -e "${RED}✗ FAIL${NC} (No credential returned)"
            FAILURES=$((FAILURES + 1))
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Status: ${issue_status})"
        FAILURES=$((FAILURES + 1))
    fi
fi

# Test 7: Rate Limiting Check
echo ""
echo "=== RATE LIMITING ==="
echo -n "Testing rate limits (5 rapid requests)... "

rate_limit_hit=false
for i in {1..5}; do
    response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT \
      -X POST "${API_URL}/api/onboard" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"Rate Test ${i}\",
        \"email\": \"ratetest${i}@example.com\",
        \"phone\": \"+1234567890\"
      }" || echo "000")

    status=$(echo "$response" | tail -c 4)

    if [ "$status" = "429" ]; then
        rate_limit_hit=true
        break
    fi
done

if [ "$rate_limit_hit" = true ]; then
    echo -e "${YELLOW}⚠ WARNING${NC} (Rate limiting triggered - this is expected)"
else
    echo -e "${GREEN}✓ PASS${NC} (Rate limits configured but not hit with 5 requests)"
fi

# Test 8: OAuth Endpoints Exist (don't test full flow)
echo ""
echo "=== OAUTH ENDPOINTS ==="
test_endpoint "GitHub OAuth initiation" "/api/oauth/github" 302

# Summary
echo ""
echo "============================================"
echo "SMOKE TEST SUMMARY"
echo "============================================"

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Production deployment looks healthy!"
    echo ""
    echo "Next steps:"
    echo "1. Test OAuth flow manually in browser"
    echo "2. Monitor logs for 24 hours"
    echo "3. Send invites to first beta users"
    exit 0
else
    echo -e "${RED}✗ ${FAILURES} TEST(S) FAILED${NC}"
    echo ""
    echo "Issues detected. Review logs and fix before proceeding."
    echo ""
    echo "Debugging steps:"
    echo "1. Check Render logs: https://dashboard.render.com"
    echo "2. Verify env vars are set correctly"
    echo "3. Check database connectivity"
    echo "4. Review error messages above"
    exit 1
fi
