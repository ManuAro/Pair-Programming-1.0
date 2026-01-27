# GitHub OAuth Setup - Step-by-Step Guide

**Time Required:** 5-10 minutes
**Prerequisites:** GitHub account

---

## WHY GITHUB OAUTH?

GitHub OAuth allows TrustLayer to:
1. Verify contractor identity via GitHub profile
2. Access public GitHub data (username, profile, email)
3. Confirm contractors control their claimed GitHub accounts
4. Build trust through GitHub's existing reputation system

**Security:** OAuth is more secure than asking for GitHub passwords. GitHub never shares passwords with TrustLayer.

---

## STEP 1: ACCESS GITHUB DEVELOPER SETTINGS

1. Log into GitHub
2. Navigate to: **https://github.com/settings/developers**
3. Click on **"OAuth Apps"** tab in left sidebar
4. Click **"New OAuth App"** button (top right)

---

## STEP 2: CONFIGURE OAUTH APPLICATION

Fill in the form with these values:

### Application name
```
TrustLayer (Production)
```
*Note: Use "(Development)" suffix for local testing*

### Homepage URL

**For Production:**
```
https://trustlayer-api.onrender.com
```

**For Local Testing:**
```
http://localhost:3001
```

### Application description (optional)
```
Verifiable credentials for contractors. Trustworthy identity verification through OAuth.
```

### Authorization callback URL

**CRITICAL - This MUST match exactly:**

**For Production:**
```
https://trustlayer-api.onrender.com/api/oauth/github/callback
```

**For Local Testing:**
```
http://localhost:3001/api/oauth/github/callback
```

⚠️ **Common Mistakes:**
- ❌ Trailing slash: `https://...callback/` (WRONG)
- ❌ Wrong protocol: `http://` instead of `https://` for production
- ❌ Wrong domain: `trustlayer.com` instead of `trustlayer-api.onrender.com`
- ✅ Exact match required: `https://trustlayer-api.onrender.com/api/oauth/github/callback`

### Enable Device Flow (optional)
Leave **UNCHECKED** (not needed for MVP)

---

## STEP 3: REGISTER APPLICATION

1. Review all fields for typos
2. Click **"Register application"**
3. ✅ Success: You'll see your new OAuth app page

---

## STEP 4: SAVE CLIENT ID

You'll immediately see:

```
Client ID: Iv1.xxxxxxxxxxxxxxxx
```

**ACTION: Copy this value**

Save it temporarily (you'll need it for env vars):
```bash
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
```

---

## STEP 5: GENERATE CLIENT SECRET

1. On the OAuth app page, find **"Client secrets"** section
2. Click **"Generate a new client secret"**
3. GitHub will show the secret **ONCE** (you cannot retrieve it again)

```
Client Secret: gh_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**ACTION: Copy this value immediately**

Save it securely:
```bash
GITHUB_CLIENT_SECRET=gh_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **SECURITY WARNING:**
- Never commit this secret to git
- Never share it publicly
- Store it in env vars only
- If compromised, regenerate immediately

---

## STEP 6: VERIFY CONFIGURATION

Double-check these values match:

| Field | Production Value | Local Dev Value |
|-------|------------------|-----------------|
| Homepage URL | `https://trustlayer-api.onrender.com` | `http://localhost:3001` |
| Callback URL | `https://trustlayer-api.onrender.com/api/oauth/github/callback` | `http://localhost:3001/api/oauth/github/callback` |

---

## STEP 7: UPDATE ENVIRONMENT VARIABLES

### For Render (Production)

1. Go to Render dashboard: **https://dashboard.render.com**
2. Select your `trustlayer-api` service
3. Click **"Environment"** tab
4. Add/Update these variables:

```bash
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=gh_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OAUTH_CALLBACK_BASE_URL=https://trustlayer-api.onrender.com
```

5. Click **"Save Changes"**
6. Service will auto-redeploy (~2 minutes)

### For Local Testing

Create `workspace/packages/api/.env.local`:

```bash
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=gh_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OAUTH_CALLBACK_BASE_URL=http://localhost:3001
```

---

## STEP 8: TEST OAUTH FLOW

### Production Test

1. Open: `https://trustlayer-web.onrender.com`
2. Start onboarding flow
3. Click **"Connect GitHub"**
4. ✅ **Expected:** Redirected to GitHub authorization page
5. Click **"Authorize TrustLayer"**
6. ✅ **Expected:** Redirected back to TrustLayer with "GitHub Verified ✓"

### Local Test

```bash
cd workspace/packages/api
npm run dev
```

```bash
cd workspace/packages/web
npm run dev
```

Open: `http://localhost:5173` and test OAuth flow.

---

## COMMON ERRORS & FIXES

### Error: "Redirect URI mismatch"

**Cause:** Callback URL in GitHub OAuth app doesn't match the URL your app is using

**Fix:**
1. Check GitHub OAuth app settings
2. Verify `OAUTH_CALLBACK_BASE_URL` env var
3. Ensure NO trailing slash
4. Verify protocol (http vs https)

### Error: "Client authentication failed"

**Cause:** Invalid Client ID or Client Secret

**Fix:**
1. Verify `GITHUB_CLIENT_ID` env var matches GitHub OAuth app
2. Regenerate Client Secret in GitHub
3. Update `GITHUB_CLIENT_SECRET` env var
4. Redeploy

### Error: "State token mismatch"

**Cause:** OAuth state token expired or user took >15 minutes to authorize

**Fix:**
- Normal behavior for slow users
- User should retry OAuth flow
- Consider increasing state token expiry in code (currently 15 min)

### Error: "Access denied" or "User canceled"

**Cause:** User clicked "Cancel" on GitHub authorization page

**Fix:**
- Normal behavior
- User can retry by clicking "Connect GitHub" again

---

## UPDATING CALLBACK URL AFTER DEPLOY

If you deploy and your URL changes:

1. Go to: **https://github.com/settings/developers**
2. Click your OAuth app
3. Update **Homepage URL** and **Authorization callback URL**
4. Click **"Update application"**
5. No need to regenerate secrets - Client ID/Secret stay the same

---

## CREATING DEV + PRODUCTION OAUTH APPS

**Best Practice:** Separate OAuth apps for development and production

### Development OAuth App
- **Name:** `TrustLayer (Development)`
- **Homepage:** `http://localhost:3001`
- **Callback:** `http://localhost:3001/api/oauth/github/callback`

### Production OAuth App
- **Name:** `TrustLayer (Production)`
- **Homepage:** `https://trustlayer-api.onrender.com`
- **Callback:** `https://trustlayer-api.onrender.com/api/oauth/github/callback`

**Why separate?**
- Avoid callback URL conflicts
- Better security (dev secrets never in production)
- Clearer audit trail

---

## SECURITY BEST PRACTICES

✅ **DO:**
- Use separate OAuth apps for dev/staging/production
- Store secrets in env vars only
- Regenerate secrets if compromised
- Use HTTPS for production callbacks
- Review OAuth app access logs regularly

❌ **DON'T:**
- Commit secrets to git
- Share secrets in Slack/email
- Use same OAuth app for dev and production
- Hardcode secrets in source code

---

## GITHUB OAUTH SCOPES

TrustLayer requests these scopes:

- `user:email` - Read user email addresses (for contact)
- `read:user` - Read basic user profile (name, avatar, username)

**Why these scopes?**
- Minimal necessary access (principle of least privilege)
- No write access to user's GitHub account
- No access to private repos or code
- Only public profile data

Users can revoke access anytime at: **https://github.com/settings/applications**

---

## MONITORING OAUTH USAGE

Check OAuth usage in TrustLayer:

```sql
-- OAuth attempts
SELECT action, COUNT(*) as attempts,
       COUNT(DISTINCT contractorId) as unique_users
FROM AuditLog
WHERE action = 'oauth_github_started'
GROUP BY action;

-- OAuth success rate
SELECT
  SUM(CASE WHEN action = 'oauth_github_started' THEN 1 ELSE 0 END) as started,
  SUM(CASE WHEN action = 'verification_github_completed' THEN 1 ELSE 0 END) as completed
FROM AuditLog;
```

---

## NEED HELP?

**GitHub OAuth Documentation:**
- https://docs.github.com/en/developers/apps/building-oauth-apps

**Common Issues:**
- Callback URL mismatch → See "Common Errors & Fixes" section
- Rate limiting → GitHub allows 5000 OAuth requests/hour (more than enough for MVP)

**TrustLayer Support:**
- Check logs in Render dashboard
- Review `AuditLog` table for OAuth events
- Test locally first before production deploy

---

**✅ OAUTH SETUP COMPLETE**

Next step: Deploy to production using `DEPLOY_READY.md`
