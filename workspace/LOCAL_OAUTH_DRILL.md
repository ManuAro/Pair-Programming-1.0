# Local OAuth Drill - Testing Guide

**Purpose:** Validate OAuth flows end-to-end locally BEFORE production deploy
**Time:** 45 minutes
**Prerequisites:** GitHub/LinkedIn dev OAuth apps with localhost callbacks

---

## Setup (15 minutes)

### 1. Create Development OAuth Apps

**GitHub OAuth App (5 min):**
```
1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: ClearanceFlow DEV
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:3001/api/oauth/github/callback
4. Copy CLIENT_ID and CLIENT_SECRET
```

**LinkedIn OAuth App (10 min):**
```
1. Go to: https://www.linkedin.com/developers/apps
2. Click "Create app"
3. Fill in:
   - App name: ClearanceFlow DEV
   - Company: [Your company page - create one if needed]
   - Privacy policy URL: http://localhost:3000/privacy.html
   - Logo: Any square image
4. In "Auth" tab:
   - Add redirect URL: http://localhost:3001/api/oauth/linkedin/callback
5. Request "Sign In with LinkedIn" product (will be "pending")
6. Copy CLIENT_ID and CLIENT_SECRET
```

**Note:** LinkedIn approval takes 1-3 days. For this drill, GitHub alone is sufficient.

### 2. Configure Environment Variables

Create `.env` in `workspace/packages/api/`:

```bash
# Database
DATABASE_URL="file:./dev.db"

# OAuth - Development
GITHUB_CLIENT_ID="your_github_dev_client_id"
GITHUB_CLIENT_SECRET="your_github_dev_client_secret"
LINKEDIN_CLIENT_ID="your_linkedin_dev_client_id"
LINKEDIN_CLIENT_SECRET="your_linkedin_dev_client_secret"

# OAuth Config
OAUTH_STATE_SECRET="dev_secret_32_chars_minimum_12345"
WEB_BASE_URL="http://localhost:3000"

# RSA Keys (auto-generated on first run)
RSA_PRIVATE_KEY_PASSPHRASE="dev_passphrase"

# Optional: Sentry (leave empty for local)
SENTRY_DSN=""
```

### 3. Start Development Servers

```bash
# Terminal 1: API Server
cd workspace/packages/api
npm install
npx prisma generate
npx prisma db push
npm run dev

# Terminal 2: Web Server
cd workspace/packages/web
npm install
npm run dev

# Terminal 3: Keep this for testing commands
```

**Verify servers running:**
- API: http://localhost:3001/health
- Web: http://localhost:3000
- Swagger: http://localhost:3001/api/docs
- JWKS: http://localhost:3001/.well-known/jwks.json

---

## Test Scenarios (30 minutes)

### TC1: GitHub OAuth Happy Path (10 min)

**Objective:** Verify full GitHub OAuth flow works end-to-end

**Steps:**
1. Open http://localhost:3000
2. Click "Get Started" → Fill onboarding form
3. Submit → You should see dashboard with pending verifications
4. Click "Verify with GitHub" button
5. **Expect:** Redirect to GitHub authorization page
6. Click "Authorize" on GitHub
7. **Expect:** Redirect back to localhost:3000 with `?status=verified`
8. **Expect:** Dashboard shows GitHub verification as "Verified" ✅
9. Open DevTools → Network tab → Check API calls
10. Verify backend logged: `oauth_github_verified` in audit log

**Success Criteria:**
- ✅ Redirect to GitHub works
- ✅ Callback to localhost works
- ✅ Access token exchange successful
- ✅ Profile fetched (user + emails)
- ✅ Verification status updated to "verified"
- ✅ Audit log entry created
- ✅ UI shows verified badge

**Common Failures:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid redirect_uri" | GitHub OAuth app callback doesn't match | Must be exactly: `http://localhost:3001/api/oauth/github/callback` |
| "Invalid state" | State token expired or secret mismatch | Check `OAUTH_STATE_SECRET` is same in .env, restart API server |
| "rate limit exceeded" | Hit GitHub API rate limit | Wait 1 hour or use different GitHub account |
| Redirect to localhost fails | WEB_BASE_URL mismatch | Must be exactly: `http://localhost:3000` (no trailing slash) |

---

### TC2: LinkedIn OAuth Happy Path (10 min)

**Objective:** Verify LinkedIn OAuth flow (if app is approved)

**Steps:**
1. Continue from contractor dashboard
2. Click "Verify with LinkedIn" button
3. **Expect:** Redirect to LinkedIn authorization page
4. Click "Allow" on LinkedIn
5. **Expect:** Redirect back with `?status=verified`
6. **Expect:** Dashboard shows LinkedIn verification as "Verified" ✅

**If LinkedIn app is NOT approved yet:**
- Button should still appear
- Clicking will redirect to LinkedIn
- LinkedIn shows: "This app is not yet available"
- Contractor sees error: "LinkedIn verification pending approval"
- Backend logs: `oauth_linkedin_failed` with reason

**Success Criteria (if approved):**
- ✅ Redirect to LinkedIn works
- ✅ Profile fetched (userinfo endpoint)
- ✅ Verification marked "verified"
- ✅ Audit log created

---

### TC3: Credential Issuance + Verification (5 min)

**Objective:** Verify provisional credentials work after OAuth

**Steps:**
1. Complete GitHub OAuth (TC1)
2. Dashboard should show:
   - Identity: Verified ✅
   - GitHub: Verified ✅
   - LinkedIn: Pending (if not approved) or Verified ✅
   - Background: Pending
   - References: Pending
3. Click "Request Credential"
4. **Expect:** Modal shows "Provisional credential will be issued"
5. Click "Confirm"
6. **Expect:** Credential appears with:
   - Badge: "PROVISIONAL"
   - Valid for: 24 hours
   - Public verification link
7. Copy verification link
8. Open in incognito/private window
9. **Expect:** Public verification page shows:
   - ✅ Valid Credential
   - ⚠️ Beta disclaimer visible
   - Verified signals: identity, github (and linkedin if approved)
   - Expires: timestamp

**Success Criteria:**
- ✅ Provisional credential issued
- ✅ JWT signed with RSA key
- ✅ Public verification link works
- ✅ Beta disclaimer visible
- ✅ Expiry is 24h from issuance

---

### TC4: Rate Limiting (3 min)

**Objective:** Verify rate limiters prevent abuse

**Steps:**
1. Hit `/api/oauth/github/start` endpoint 6 times rapidly:
```bash
curl -v "http://localhost:3001/api/oauth/github/start?contractorId=test&returnTo=http://localhost:3000" 2>&1 | grep -E "(HTTP|x-ratelimit)"
```

2. **Expect:** First 5 requests return 302 (redirect)
3. **Expect:** 6th request returns 429 (Too Many Requests)
4. **Expect:** Response headers include:
   - `x-ratelimit-limit: 5`
   - `x-ratelimit-remaining: 0`
   - `retry-after: 900` (15 minutes)

**Success Criteria:**
- ✅ Rate limiter blocks 6th request
- ✅ Appropriate headers returned
- ✅ Error message clear: "Too many authentication attempts"

---

### TC5: Security - Invalid State Token (2 min)

**Objective:** Verify state token validation prevents CSRF

**Steps:**
1. Manually craft invalid callback:
```bash
curl -v "http://localhost:3001/api/oauth/github/callback?code=fake_code&state=invalid_token"
```

2. **Expect:** Response: 400 Bad Request
3. **Expect:** Error message: "Invalid state token"
4. **Expect:** No verification record created

**Success Criteria:**
- ✅ Invalid state rejected
- ✅ No side effects (no DB writes)
- ✅ Audit log shows attempted attack

---

## Debugging Checklist

**If OAuth flow breaks:**

1. **Check API logs:**
```bash
tail -f workspace/packages/api/logs/api.log
```

2. **Verify environment variables:**
```bash
cd workspace/packages/api
cat .env | grep -E "(OAUTH|WEB_BASE|GITHUB|LINKEDIN)"
```

3. **Check database state:**
```bash
cd workspace/packages/api
npx prisma studio
# Open browser to http://localhost:5555
# Inspect: Contractor, Verification, Credential tables
```

4. **Test OAuth app configuration:**
- GitHub: https://github.com/settings/developers → Your app → Check callback URL
- LinkedIn: https://www.linkedin.com/developers/apps → Your app → Auth tab → Check redirect URL

5. **Verify rate limiter state:**
```bash
# If using Redis (not in dev mode)
redis-cli
> KEYS "*ratelimit*"
> GET "ratelimit:auth:127.0.0.1"
```

---

## Expected Output

After successful drill, you should have:

**✅ Verified Working:**
- GitHub OAuth flow end-to-end
- State token generation/verification
- Access token exchange
- Profile fetching
- Verification status updates
- Audit logging
- Provisional credential issuance
- Public credential verification
- Rate limiting
- Security (CSRF protection via state tokens)

**✅ Documented Issues:**
- Any edge cases discovered
- Performance bottlenecks
- Error messages needing improvement
- UX friction points

**✅ Confidence Level:**
- High confidence for production deploy
- Known issues documented with fixes
- Manuel can execute production deploy with minimal surprises

---

## Post-Drill Actions

1. **Document Issues:**
   - Create list of any bugs found
   - Prioritize: blockers vs nice-to-haves

2. **Fix Critical Issues:**
   - Fix anything that blocks production deploy
   - Document workarounds for non-critical issues

3. **Update Production Checklist:**
   - Add any new steps discovered during drill
   - Update troubleshooting guide

4. **Report to Manuel:**
   - Summary: what worked, what didn't
   - Confidence level for production deploy
   - Estimated time for production deploy (after fixes)

---

## Next Steps After Drill

**If drill is successful:**
→ Manuel can execute production deploy with high confidence
→ Follow `PRODUCTION_CHECKLIST.md` Phase 2
→ Should take 30-60 min (not 2+ hours)

**If drill reveals issues:**
→ Fix critical bugs first
→ Re-run drill to verify fixes
→ Then proceed to production deploy

---

**Estimated Total Time:**
- Setup: 15 min
- Test scenarios: 30 min
- Document findings: 10 min
- Fix critical issues: 15-30 min (if any)

**Total: 1-1.5 hours from zero to production-ready confidence**
