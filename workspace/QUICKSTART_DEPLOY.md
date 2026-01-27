# QUICKSTART: Deploy TrustLayer to Production in 30 Minutes

**For:** Manuel (or anyone with GitHub + Render accounts)
**Time:** 30 minutes
**Result:** TrustLayer live in production

---

## Prerequisites (Have These Ready)

- [ ] GitHub account logged in
- [ ] Render.com account logged in (free tier: https://dashboard.render.com/register)
- [ ] Terminal open
- [ ] 30 minutes of focused time
- [ ] This repository pushed to GitHub

---

## Step 1: GitHub OAuth App (5 minutes)

1. Go to: https://github.com/settings/developers
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in:
   - **Name:** `TrustLayer (Production)`
   - **Homepage:** `https://trustlayer.onrender.com` (temporary, we'll update)
   - **Callback:** `https://trustlayer-api.onrender.com/api/oauth/github/callback`
4. Click "Register application"
5. **SAVE THESE IMMEDIATELY:**
   ```
   Client ID: Iv1.xxxxxxxxxx (copy this)
   ```
6. Click "Generate a new client secret"
7. **SAVE THIS IMMEDIATELY (can't retrieve later):**
   ```
   Client Secret: gh_secret_xxxxxxxxxx (copy this)
   ```

⚠️ **Save both values to a temporary file on your desktop (don't commit)**

---

## Step 2: Deploy API on Render (10 minutes)

1. Go to: https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** `trustlayer-api`
   - **Region:** Oregon (US West)
   - **Branch:** `main`
   - **Root Directory:** `workspace/packages/api`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

5. Click "Advanced" → Add Environment Variables:

```bash
NODE_ENV=production
PORT=3001
GITHUB_CLIENT_ID=paste_your_client_id_from_step_1
GITHUB_CLIENT_SECRET=paste_your_client_secret_from_step_1
TEST_MODE=false
ENABLE_LINKEDIN_OAUTH=false
RATE_LIMIT_ONBOARD_MAX=10
RATE_LIMIT_ONBOARD_WINDOW_MIN=15
RATE_LIMIT_VERIFY_MAX=50
RATE_LIMIT_VERIFY_WINDOW_MIN=15
RATE_LIMIT_CREDENTIAL_MAX=20
RATE_LIMIT_CREDENTIAL_WINDOW_MIN=15
```

6. Add PostgreSQL Database:
   - In Render dashboard: "New +" → "PostgreSQL"
   - **Name:** `trustlayer-db`
   - **Database:** `trustlayer`
   - **Region:** Oregon (same as API)
   - **Plan:** Free
   - Click "Create Database"

7. Link Database to API:
   - Copy "Internal Database URL" from PostgreSQL dashboard
   - Go back to API service → Environment
   - Add variable:
     ```
     DATABASE_URL=paste_internal_database_url_here
     ```
   - Add another variable (generate random secret):
     ```bash
     # Generate secret first:
     openssl rand -base64 32
     # Then add:
     JWT_SECRET=paste_generated_secret_here
     ```

8. Set OAuth callback URL:
   - Add variable:
     ```
     OAUTH_CALLBACK_BASE_URL=https://trustlayer-api.onrender.com
     ```

9. Click "Create Web Service"

10. **WAIT 3-5 MINUTES** for build

11. **VERIFY:** Check logs for "Server running on port 3001"

---

## Step 3: Update GitHub OAuth Callback (2 minutes)

Now that we have the real Render URL:

1. Go back to: https://github.com/settings/developers
2. Click your "TrustLayer (Production)" OAuth app
3. Update:
   - **Homepage URL:** `https://trustlayer-api.onrender.com`
   - **Callback URL:** `https://trustlayer-api.onrender.com/api/oauth/github/callback`
4. Click "Update application"

---

## Step 4: Deploy Web Frontend (5 minutes)

### Option A: Render (Simple)

1. Render dashboard → "New +" → "Static Site"
2. Connect same repository
3. Configure:
   - **Name:** `trustlayer-web`
   - **Branch:** `main`
   - **Root Directory:** `workspace/packages/web`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Environment Variables:
   ```
   VITE_API_URL=https://trustlayer-api.onrender.com
   ```
5. Click "Create Static Site"
6. Wait 2-3 minutes

### Option B: Vercel (Faster)

```bash
cd workspace/packages/web
npm install -g vercel
vercel --prod
# When prompted for VITE_API_URL:
# https://trustlayer-api.onrender.com
```

---

## Step 5: Smoke Test (5 minutes)

Run automated validation:

```bash
cd workspace
chmod +x SMOKE_TEST.sh
./SMOKE_TEST.sh https://trustlayer-api.onrender.com
```

**Expected output:**
```
✅ Health check: PASS
✅ JWKS endpoint: PASS
✅ Onboarding: PASS
✅ Identity verification: PASS
✅ Credential issuance: PASS
✅ Credential verification: PASS
⚠️  Rate limiting: WARNING (expected)
✅ OAuth endpoints: PASS

🎉 ALL TESTS PASSED
```

---

## Step 6: Manual OAuth Test (3 minutes)

1. Open: `https://trustlayer-web.onrender.com` (or your Vercel URL)
2. Click "Start Verification"
3. Fill in:
   - Name: Your name
   - Email: Your email
   - Phone: Any number
4. Click "Connect GitHub"
5. ✅ **Expected:** GitHub authorization page appears
6. Click "Authorize TrustLayer"
7. ✅ **Expected:** Redirected back with "GitHub Verified ✓"
8. ✅ **Expected:** Credential issued (likely PROVISIONAL without references)

---

## ✅ SUCCESS!

**If all above passed, you're LIVE in production! 🎉**

**Your URLs:**
- **API:** https://trustlayer-api.onrender.com
- **Web:** https://trustlayer-web.onrender.com (or Vercel URL)

---

## What to Monitor (First 24 Hours)

1. **Render Logs:**
   - Dashboard → trustlayer-api → Logs
   - Watch for errors

2. **Database:**
   - Check contractors being created:
   ```sql
   SELECT COUNT(*) FROM Contractor;
   ```

3. **OAuth Success Rate:**
   ```sql
   SELECT
     SUM(CASE WHEN action = 'oauth_github_started' THEN 1 ELSE 0 END) as started,
     SUM(CASE WHEN action = 'verification_github_completed' THEN 1 ELSE 0 END) as completed
   FROM AuditLog;
   ```

---

## Next Steps

1. **Share with 5 beta testers** (use templates in `OUTREACH_TEMPLATES.md`)
2. **Monitor for 24 hours**
3. **Review feedback**
4. **Iterate based on real usage**

---

## If Something Goes Wrong

**See: `ROLLBACK.md` for detailed procedures**

**Quick rollback (2 minutes):**
1. Render dashboard → trustlayer-api
2. Events tab
3. Find last successful deploy
4. Click "Rollback to this version"

---

## Need Help?

- **Detailed deployment guide:** `DEPLOY_READY.md`
- **OAuth setup issues:** `GITHUB_OAUTH_SETUP.md`
- **Rollback procedures:** `ROLLBACK.md`
- **Test validation:** Run `./SMOKE_TEST.sh`

---

**LET'S GO! 🚀**
