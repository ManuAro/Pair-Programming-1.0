# DEPLOY READY - Production Deployment Checklist

**Status:** READY TO EXECUTE
**Estimated Time:** 30 minutes
**Platform:** Render.com (Free Tier)
**Target:** Production with GitHub OAuth

---

## PREREQUISITES

✅ GitHub account (for OAuth app creation)
✅ Render.com account (free tier)
✅ Git repository pushed to GitHub
✅ 30 minutes of focused time

---

## PHASE 1: GITHUB OAUTH APP (10 minutes)

### Step 1: Create GitHub OAuth Application

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** `TrustLayer (Production)`
   - **Homepage URL:** `https://trustlayer.onrender.com` (will update after Render deploy)
   - **Authorization callback URL:** `https://trustlayer.onrender.com/api/oauth/github/callback`
4. Click "Register application"
5. **SAVE IMMEDIATELY:**
   - Client ID: `gh_xxxxxxxxxx`
   - Client Secret: `gh_secret_xxxxxxxxxx` (click "Generate a new client secret")

⚠️ **CRITICAL:** Save Client Secret NOW. You cannot retrieve it later.

### Step 2: Store Credentials Securely

Create a local file (DO NOT COMMIT):
```bash
# Save to ~/trustlayer-secrets.txt
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

---

## PHASE 2: RENDER DEPLOYMENT (15 minutes)

### Step 1: Connect Repository to Render

1. Go to: https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository: `manuelarocena/pair-programming-workflow`
5. Configure service:
   - **Name:** `trustlayer-api`
   - **Region:** Oregon (US West) - lowest latency for MVP
   - **Branch:** `main`
   - **Root Directory:** `workspace/packages/api`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

### Step 2: Add Environment Variables

Click "Advanced" → "Add Environment Variable" and add:

```bash
# Core Config
NODE_ENV=production
PORT=3001

# Database (Render provides this automatically for PostgreSQL)
DATABASE_URL=${DATABASE_URL}

# GitHub OAuth (from Phase 1)
GITHUB_CLIENT_ID=your_client_id_from_phase_1
GITHUB_CLIENT_SECRET=your_secret_from_phase_1
OAUTH_CALLBACK_BASE_URL=https://trustlayer-api.onrender.com

# JWT Signing (generate new secret)
JWT_SECRET=$(openssl rand -base64 32)

# Feature Flags
TEST_MODE=false
ENABLE_LINKEDIN_OAUTH=false

# Rate Limiting (conservative defaults)
RATE_LIMIT_ONBOARD_MAX=10
RATE_LIMIT_ONBOARD_WINDOW_MIN=15
RATE_LIMIT_VERIFY_MAX=50
RATE_LIMIT_VERIFY_WINDOW_MIN=15
RATE_LIMIT_CREDENTIAL_MAX=20
RATE_LIMIT_CREDENTIAL_WINDOW_MIN=15
```

### Step 3: Add PostgreSQL Database

1. In Render dashboard, click "New +" → "PostgreSQL"
2. **Name:** `trustlayer-db`
3. **Database:** `trustlayer`
4. **User:** `trustlayer_user`
5. **Region:** Same as web service (Oregon)
6. **Plan:** Free
7. Click "Create Database"
8. **Copy Internal Database URL** (starts with `postgresql://...`)
9. Go back to your web service → Environment
10. Update `DATABASE_URL` with the internal URL

### Step 4: Deploy

1. Click "Create Web Service"
2. Wait for build (3-5 minutes)
3. Watch logs for errors
4. ✅ Success indicator: `Server running on port 3001`

### Step 5: Update GitHub OAuth Callback

1. Go back to GitHub OAuth app settings
2. Update **Homepage URL:** `https://trustlayer-api.onrender.com`
3. Update **Authorization callback URL:** `https://trustlayer-api.onrender.com/api/oauth/github/callback`
4. Save changes

---

## PHASE 3: WEB FRONTEND (5 minutes)

### Option A: Deploy Web on Render

1. Click "New +" → "Static Site"
2. Connect same repository
3. **Root Directory:** `workspace/packages/web`
4. **Build Command:** `npm install && npm run build`
5. **Publish Directory:** `dist`
6. **Environment Variables:**
   ```bash
   VITE_API_URL=https://trustlayer-api.onrender.com
   ```
7. Deploy

### Option B: Deploy Web on Vercel (Faster)

```bash
cd workspace/packages/web
npm install -g vercel
vercel --prod
# Follow prompts
# Set env var: VITE_API_URL=https://trustlayer-api.onrender.com
```

---

## PHASE 4: SMOKE TEST (5 minutes)

Run automated smoke test:

```bash
cd workspace
chmod +x SMOKE_TEST.sh
./SMOKE_TEST.sh https://trustlayer-api.onrender.com
```

**Expected output:**
```
✅ Health check: OK
✅ JWKS endpoint: OK (RSA public key found)
✅ Onboarding: OK (contractor created)
✅ Credential issuance: OK
✅ Credential verification: OK
🎉 SMOKE TEST PASSED
```

### Manual Verification

1. Open: `https://trustlayer-web.onrender.com` (or your Vercel URL)
2. Click "Start Verification"
3. Fill basic info
4. Click "Connect GitHub"
5. Authorize on GitHub
6. ✅ You should see: "GitHub Verified ✓"
7. Check credential tier (likely PROVISIONAL without references)

---

## SUCCESS CRITERIA

✅ API responding on Render URL
✅ Database migrations ran successfully
✅ GitHub OAuth flow works end-to-end
✅ Credential issued after verification
✅ Public credential verifiable via `/api/credentials/:id/verify`
✅ No errors in Render logs

---

## IF SOMETHING FAILS

See: `ROLLBACK.md` for contingency procedures

Common issues:
- **"Client Secret invalid"** → Regenerate in GitHub OAuth app settings
- **"Database connection failed"** → Check DATABASE_URL in Render env vars
- **"Callback mismatch"** → Verify OAuth callback URLs match exactly
- **"502 Bad Gateway"** → Wait 2 min for cold start, then retry

---

## POST-DEPLOYMENT

### 1. Monitor Logs (First 24h)

```bash
# In Render dashboard
Dashboard → trustlayer-api → Logs → Live logs
```

Watch for:
- Unexpected errors
- Rate limit triggers
- OAuth failures

### 2. Track Metrics

Query database for early signals:
```sql
-- User acquisition
SELECT COUNT(*) as total_contractors FROM Contractor;

-- Conversion rate
SELECT
  COUNT(*) as total_contractors,
  SUM(CASE WHEN tier = 'FULL_CLEARANCE' THEN 1 ELSE 0 END) as full_clearance,
  SUM(CASE WHEN tier = 'PROVISIONAL' THEN 1 ELSE 0 END) as provisional
FROM Contractor WHERE credentialId IS NOT NULL;

-- OAuth demand
SELECT action, COUNT(*) as attempts
FROM AuditLog
WHERE action LIKE 'oauth_%'
GROUP BY action;
```

### 3. Share with First Users

Template DM:
```
Hey! We just launched TrustLayer - verifiable credentials for contractors.

Get your verified credential: https://trustlayer-web.onrender.com

Takes 5 min. Would love your feedback!
```

---

## TIMELINE

- **T+0:** Deploy complete
- **T+24h:** Review logs, check for errors
- **T+48h:** First user metrics review
- **T+1week:** Iterate based on real feedback

---

## NEXT ITERATION (After Initial Validation)

- [ ] Add LinkedIn OAuth (if users request it)
- [ ] Implement reference verification flow
- [ ] Add email notifications
- [ ] Create admin dashboard
- [ ] Integrate Checkr for background checks
- [ ] Add custom domain

---

**READY TO SHIP? Execute Phase 1 now. 🚀**
