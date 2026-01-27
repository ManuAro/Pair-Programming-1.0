# Production Launch Checklist

**Estimated time to production: 2-4 hours**

This checklist ensures you launch safely and can iterate quickly.

---

## Phase 1: Pre-Deployment (45 min)

### OAuth Applications Setup

- [ ] **GitHub OAuth App** (10 min)
  - Create at: https://github.com/settings/developers
  - App Name: `Contractor Passport (Production)`
  - Homepage URL: Your production domain
  - Callback URL: `https://your-domain.com/api/oauth/github/callback`
  - Save Client ID and Secret securely
  - See: `OAUTH_APP_CREATION.md` for detailed steps

- [ ] **LinkedIn OAuth App** (20 min)
  - Create at: https://www.linkedin.com/developers/
  - Requires Company Page (create if needed)
  - Privacy Policy URL: `https://your-domain.com/privacy.html`
  - Callback URL: `https://your-domain.com/api/oauth/linkedin/callback`
  - Request "Sign In with LinkedIn" product access
  - Save Client ID and Secret securely
  - **Note:** LinkedIn approval takes 1-3 business days

- [ ] **Sentry Account** (5 min) - OPTIONAL but recommended
  - Create project at: https://sentry.io
  - Copy DSN for error monitoring
  - Can skip for initial launch

- [ ] **Environment Variables Documented** (10 min)
  - Copy `.env.production.example` to secure location (1Password, Vault)
  - Fill in all OAuth credentials
  - Generate secure secrets (use `openssl rand -base64 32`)

---

## Phase 2: Deployment (1-2 hours)

### Option A: Railway (Recommended - Fastest)

**Time: 30 minutes**

- [ ] Install Railway CLI
  ```bash
  npm install -g @railway/cli
  railway login
  ```

- [ ] Run automated deployment script
  ```bash
  cd workspace
  ./deploy-railway.sh
  ```

- [ ] Follow prompts:
  - Enter project name
  - Enter GitHub OAuth credentials
  - Enter LinkedIn OAuth credentials
  - Enter Web Base URL
  - Enter Sentry DSN (optional)

- [ ] Deployment completes automatically:
  - PostgreSQL database created
  - Redis instance created
  - Environment variables set
  - Database migrations run
  - API deployed
  - Health check verified

- [ ] Save Railway URLs:
  - API: `https://contractor-passport-api.up.railway.app`
  - Copy to clipboard for next steps

### Option B: Docker Compose (Self-Hosted VPS)

**Time: 1-2 hours**

- [ ] Provision VPS (DigitalOcean, AWS, etc.)
  - Minimum: 2GB RAM, 2 CPU cores, 20GB disk
  - Ubuntu 22.04 LTS recommended

- [ ] SSH into server
  ```bash
  ssh root@your-server-ip
  ```

- [ ] Install Docker
  ```bash
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  ```

- [ ] Clone repository
  ```bash
  git clone https://github.com/yourorg/contractor-passport.git
  cd contractor-passport/workspace
  ```

- [ ] Configure environment
  ```bash
  cp .env.production.example .env.production
  nano .env.production  # Fill all values
  ```

- [ ] Start services
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```

- [ ] Run migrations
  ```bash
  docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
  ```

- [ ] Verify health
  ```bash
  curl http://localhost:3001/health
  ```

- [ ] Setup SSL (Cloudflare recommended)
  - Point domain DNS to server IP
  - Add domain to Cloudflare
  - Enable "Full (strict)" SSL mode
  - Enable "Always Use HTTPS"

### Option C: Render / Vercel / Fly.io

**Time: 1 hour**

See `DEPLOY.md` for platform-specific instructions.

---

## Phase 3: Post-Deployment Validation (30 min)

### Health Checks

- [ ] **API Health Endpoint**
  ```bash
  curl https://your-domain.com/health
  # Expected: {"status":"ok","timestamp":"..."}
  ```

- [ ] **JWKS Endpoint**
  ```bash
  curl https://your-domain.com/.well-known/jwks.json
  # Expected: {"keys":[{...}]}
  ```

- [ ] **Swagger UI**
  - Visit: `https://your-domain.com/api/docs`
  - Verify all endpoints documented

- [ ] **Legal Pages**
  - Visit: `https://your-domain.com/privacy.html`
  - Visit: `https://your-domain.com/terms.html`
  - Both should load without errors

### OAuth Flow Testing

- [ ] **GitHub OAuth End-to-End**
  1. Visit production URL
  2. Onboard a test contractor (use your real info)
  3. Click "Verify with GitHub"
  4. Authorize on GitHub
  5. Verify redirect back to app
  6. Check verification shows "Verified" badge with timestamp
  7. Check audit logs in database

- [ ] **LinkedIn OAuth End-to-End**
  1. Same as GitHub but with LinkedIn
  2. **Note:** Only works after LinkedIn approval (1-3 days)

- [ ] **OAuth Error Handling**
  1. Start OAuth flow
  2. Click "Cancel" on provider page
  3. Verify app handles error gracefully
  4. Check that verification stays "Pending" (not "Failed")

### Credential Issuance Testing

- [ ] **Issue Provisional Credential**
  1. Complete GitHub OAuth verification
  2. Wait for credential to be issued (automatic after 2+ verifications)
  3. Check that credential tier is `PROVISIONAL`
  4. Check that credential expires in 24h
  5. Copy public verification link

- [ ] **Verify Credential Publicly**
  1. Open verification link in incognito browser
  2. Verify badge shows "Valid Credential"
  3. Verify beta disclaimer is visible
  4. Verify verified signals are listed (GitHub, LinkedIn)
  5. Check credential details match

### Security Testing

- [ ] **Rate Limiting**
  ```bash
  # Test OAuth rate limit (5 req/15min)
  for i in {1..6}; do
    curl https://your-domain.com/api/oauth/github/start?contractorId=test
    echo "Request $i"
  done
  # 6th request should return 429 Too Many Requests
  ```

- [ ] **CORS Configuration**
  ```bash
  curl -H "Origin: https://evil.com" \
       -H "Access-Control-Request-Method: POST" \
       -X OPTIONS \
       https://your-domain.com/api/onboard
  # Should not return Access-Control-Allow-Origin: https://evil.com
  ```

- [ ] **Error Handling (No Stack Traces)**
  ```bash
  curl https://your-domain.com/api/contractors/invalid-id
  # Should return clean error, no stack trace
  ```

### Monitoring Setup

- [ ] **Sentry Error Tracking** (if configured)
  1. Trigger test error: `throw new Error('Test Sentry integration')`
  2. Check Sentry dashboard for error
  3. Verify error includes context (user, endpoint, request ID)

- [ ] **Structured Logging**
  ```bash
  # Check logs (Railway)
  railway logs

  # Check logs (Docker)
  docker-compose -f docker-compose.prod.yml logs -f api

  # Verify JSON format:
  # {"level":"info","time":"...","msg":"Request received",...}
  ```

---

## Phase 4: Initial User Validation (2-4 hours)

### Outreach Preparation

- [ ] **Review Outreach Templates**
  - Read: `OUTREACH_TEMPLATES.md`
  - Choose Template 1 (LinkedIn DM) or Template 2 (Twitter DM)
  - Personalize first sentence for each target

- [ ] **Identify 10 Target Contractors**
  - Search LinkedIn: "freelance developer"
  - Filter: Active GitHub profiles
  - Filter: Recent posts about client work
  - Save profile URLs

### Send 10 DMs

- [ ] **Day 1: Send 5 LinkedIn DMs** (Monday recommended)
  - Use Template 1: "Background checks taking 6+ weeks?"
  - Personalize first sentence
  - Track in spreadsheet: Name, URL, Date Sent, Response?

- [ ] **Day 1: Send 5 Twitter/X DMs**
  - Use Template 2: Short curiosity hook
  - Track same metrics

### Track Metrics

- [ ] **Create Tracking Spreadsheet**
  - Columns: Name, Platform, Date Sent, Response?, Sign-up?, OAuth Complete?, Feedback
  - Goal: 20% reply rate, 10% sign-up rate

- [ ] **Monitor User Actions**
  ```sql
  -- Check onboarding activity
  SELECT * FROM "Contractor"
  WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  ORDER BY "createdAt" DESC;

  -- Check OAuth verifications
  SELECT * FROM "Verification"
  WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  ORDER BY "createdAt" DESC;

  -- Check credentials issued
  SELECT * FROM "Credential"
  WHERE "issuedAt" > NOW() - INTERVAL '24 hours'
  ORDER BY "issuedAt" DESC;
  ```

### User Interviews

- [ ] **Follow Up with Active Users** (24h after sign-up)
  - Email: "Saw you tried Contractor Passport - feedback?"
  - Questions:
    1. Was the onboarding clear?
    2. Was OAuth verification too complicated?
    3. Would you pay $249 to speed up verification by 5+ weeks?
    4. What's missing?

---

## Phase 5: Iteration Based on Feedback (Week 1)

### Red Flags (Pivot Signals)

- [ ] **<10% reply rate to DMs**
  - Action: Try different messaging (Template 2)

- [ ] **People sign up but don't complete OAuth**
  - Action: Simplify onboarding or add clearer value explanation

- [ ] **Users say "not useful"**
  - Action: Deep dive interviews - what would make it useful?

- [ ] **Everyone says "I'd use this if it was free"**
  - Action: Not a strong pain point → pivot to different problem

### Green Lights (Double Down Signals)

- [ ] **>20% reply rate to DMs**
  - Action: Expand outreach to 50 contractors

- [ ] **>50% complete OAuth after signing up**
  - Action: Focus on improving post-OAuth flow

- [ ] **Users ask "when is background check integration ready?"**
  - Action: Prioritize Checkr integration

- [ ] **Users refer other contractors unprompted**
  - Action: Add referral incentive

---

## Emergency Procedures

### If OAuth Apps Get Rejected

**GitHub:**
- Usually doesn't reject unless callback URL is malicious
- If rejected: contact support@github.com

**LinkedIn:**
- Most common issue: Privacy Policy not accessible
- Fix: Ensure `/privacy.html` loads without auth
- Resubmit: Products tab → "Sign In with LinkedIn" → Request Access

### If Site Goes Down

**Check health endpoint:**
```bash
curl https://your-domain.com/health
```

**Check Railway logs:**
```bash
railway logs
```

**Common issues:**
1. Database connection error → Check `DATABASE_URL` env var
2. Out of memory → Upgrade Railway plan or restart
3. Rate limit exceeded → Temporary, wait 15 minutes

**Emergency rollback:**
```bash
# Railway
railway rollback

# Docker
git checkout <previous-commit>
docker-compose -f docker-compose.prod.yml up -d --build
```

### If Users Report Bugs

1. **Check Sentry for errors** (if configured)
2. **Check audit logs in database**
3. **Reproduce locally**
4. **Fix and deploy within 24h** (users are watching)
5. **Email affected users with update**

---

## Success Criteria

### Week 1 Goals

- [ ] **10 DMs sent**
- [ ] **2+ contractors sign up** (20% conversion)
- [ ] **1+ completes OAuth verification** (50% activation)
- [ ] **Zero P0 bugs** (nothing breaks during user testing)
- [ ] **3+ pieces of actionable feedback**

### Week 1 Decisions

Based on metrics, decide:

**If metrics are GOOD (hitting goals):**
- [ ] Expand outreach to 50 contractors
- [ ] Ship background check integration (Checkr)
- [ ] Add email notifications for verification complete
- [ ] Create employer verification flow

**If metrics are MEH (some interest but not strong):**
- [ ] Deep dive interviews with 5 users
- [ ] Identify what's missing
- [ ] Ship 1-2 key features based on feedback
- [ ] Re-test with another 10 contractors

**If metrics are BAD (no interest):**
- [ ] Pivot to different audience (agencies, HR, staffing firms)
- [ ] Pivot to different problem (portable reputation, reference network)
- [ ] Or: shut down and move to next idea

---

## Final Pre-Launch Checklist

**Before sending ANY DMs, verify:**

- [ ] Product is live at production URL
- [ ] OAuth flows tested end-to-end
- [ ] Privacy Policy + Terms accessible
- [ ] Beta disclaimers visible in UI
- [ ] Error monitoring enabled
- [ ] You can respond to bugs within 24h
- [ ] You have spreadsheet ready to track metrics
- [ ] You're mentally prepared for "this is useless" feedback

---

## Post-Launch (Week 2+)

- [ ] **Send weekly updates to beta users**
  - What shipped this week
  - What's coming next week
  - Request feedback

- [ ] **Monitor metrics daily**
  - Sign-ups, OAuth completion, credentials issued
  - Error rates, response times

- [ ] **Ship based on feedback**
  - Don't wait for "perfect" - ship fast iterations

- [ ] **Add testimonials** (if users love it)
  - Ask: "Can I quote your feedback on the site?"
  - Add to landing page

---

## Resources

- **Deployment Guide:** `DEPLOY.md`
- **OAuth Setup:** `OAUTH_APP_CREATION.md`
- **Outreach Templates:** `OUTREACH_TEMPLATES.md`
- **Architecture Docs:** `ARQUITECTURA.md` (if exists)
- **API Docs:** `https://your-domain.com/api/docs`

---

**Time Investment Summary:**

- OAuth Apps Setup: 30 min
- Deployment: 30 min - 2 hours (depending on platform)
- Testing: 30 min
- Outreach: 2 hours (10 DMs + tracking)

**Total: 3-5 hours from zero to first users**

🚀 **You're ready to launch. Ship it!**
