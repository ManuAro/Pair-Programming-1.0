# OAuth Application Creation Guide

**Time required:** 30 minutes
**Prerequisites:** GitHub account, LinkedIn account (with Company Page for LinkedIn)

---

## GitHub OAuth App Setup (10 minutes)

### Step 1: Navigate to GitHub Developer Settings

1. Go to: https://github.com/settings/developers
2. Click **"OAuth Apps"** in the left sidebar
3. Click **"New OAuth App"** button

### Step 2: Fill Application Details

**Application name:**
```
Contractor Passport (Production)
```

**Homepage URL:**
```
https://your-domain.com
```
(Replace with your actual domain or Railway URL)

**Application description:**
```
Contractor verification platform - speeds up background checks from 6 weeks to 24 hours through verified digital signals.
```

**Authorization callback URL:**
```
https://your-domain.com/api/oauth/github/callback
```
**CRITICAL:** This must match exactly. No trailing slash.

### Step 3: Register Application

1. Click **"Register application"**
2. You'll see your **Client ID** - copy this immediately
3. Click **"Generate a new client secret"**
4. Copy the **Client Secret** immediately (you can't see it again!)

### Step 4: Save Credentials

**Add to your `.env.production` file:**
```bash
GITHUB_CLIENT_ID=Iv1.abc123xyz...
GITHUB_CLIENT_SECRET=ghp_abc123xyz...
GITHUB_REDIRECT_URI=https://your-domain.com/api/oauth/github/callback
```

### Step 5: Test (After Deployment)

```bash
# Test OAuth flow
curl "https://your-domain.com/api/oauth/github/start?contractorId=test123&returnTo=https://your-domain.com"

# Should redirect to GitHub authorization page
```

---

## LinkedIn OAuth App Setup (20 minutes)

**IMPORTANT:** LinkedIn requires a Company Page. If you don't have one, create it first:
1. Go to: https://www.linkedin.com/company/setup/new/
2. Create a minimal company page (takes 5 minutes)

### Step 1: Navigate to LinkedIn Developer Portal

1. Go to: https://www.linkedin.com/developers/
2. Click **"Create app"**

### Step 2: Fill Application Details

**App name:**
```
Contractor Passport
```

**LinkedIn Page:**
- Select your company page from the dropdown
- (If you don't see your company, you may need to request admin access)

**Privacy policy URL:**
```
https://your-domain.com/privacy.html
```

**App logo:**
- Upload a logo (minimum 300x300 pixels)
- You can use a placeholder from https://placeholder.com/300x300

**Legal agreement:**
- Check "I have read and agree to these terms"

### Step 3: Create App

1. Click **"Create app"**
2. You'll be redirected to the app settings page

### Step 4: Configure Auth Settings

1. Go to the **"Auth"** tab
2. Under **"OAuth 2.0 settings"**, add:

**Authorized redirect URLs:**
```
https://your-domain.com/api/oauth/linkedin/callback
```
**CRITICAL:** This must match exactly. No trailing slash.

3. Click **"Add redirect URL"**

### Step 5: Request OAuth Scopes

1. Go to the **"Products"** tab
2. Find **"Sign In with LinkedIn using OpenID Connect"**
3. Click **"Request access"**

**IMPORTANT:** LinkedIn may take 1-3 business days to approve. During review they check:
- Privacy Policy is accessible and complete
- App description explains data usage
- Company Page is legitimate

### Step 6: Get Credentials

1. Go back to the **"Auth"** tab
2. Copy your **Client ID**
3. Copy your **Client Secret** (click "Show" if hidden)

### Step 7: Save Credentials

**Add to your `.env.production` file:**
```bash
LINKEDIN_CLIENT_ID=78abc123xyz
LINKEDIN_CLIENT_SECRET=abc123xyz...
LINKEDIN_REDIRECT_URI=https://your-domain.com/api/oauth/linkedin/callback
```

### Step 8: Test (After Deployment + Approval)

```bash
# Test OAuth flow
curl "https://your-domain.com/api/oauth/linkedin/start?contractorId=test123&returnTo=https://your-domain.com"

# Should redirect to LinkedIn authorization page
```

---

## Development vs Production Apps

**IMPORTANT:** You need **separate OAuth apps** for development and production.

### Development Apps

**GitHub:**
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3001/api/oauth/github/callback`

**LinkedIn:**
- Callback URL: `http://localhost:3001/api/oauth/linkedin/callback`

**Save in `.env.local`:**
```bash
GITHUB_CLIENT_ID=Iv1.DEV123...
GITHUB_CLIENT_SECRET=ghp_DEV123...
GITHUB_REDIRECT_URI=http://localhost:3001/api/oauth/github/callback

LINKEDIN_CLIENT_ID=78DEV123
LINKEDIN_CLIENT_SECRET=DEV123...
LINKEDIN_REDIRECT_URI=http://localhost:3001/api/oauth/linkedin/callback
```

### Production Apps

Use the production URLs (as shown above in Step 4 and Step 7).

---

## Troubleshooting

### GitHub OAuth Issues

**Error: "The redirect_uri MUST match the registered callback URL for this application"**
- **Solution:** Check that `GITHUB_REDIRECT_URI` exactly matches the callback URL in GitHub settings
- Common mistake: trailing slash (`/callback/` vs `/callback`)

**Error: "Bad verification code"**
- **Solution:** Code might have expired (15 min TTL). Try again.

**Error: User authorizes but nothing happens**
- **Solution:** Check backend logs. Likely issue with state token validation or database write.

### LinkedIn OAuth Issues

**Error: "Application is not approved for this product"**
- **Solution:** You haven't been approved for "Sign In with LinkedIn". Wait 1-3 business days or check Products tab.

**Error: "Invalid redirect_uri"**
- **Solution:** Same as GitHub - check exact match. LinkedIn is stricter than GitHub.

**Error: "Access Denied"**
- **Solution:** User declined authorization. This is normal - not all users will authorize.

**LinkedIn approval taking too long?**
- **Solution:** Make sure:
  1. Privacy Policy is publicly accessible
  2. Company Page is complete (logo, description, website)
  3. App description clearly explains why you need user data

---

## Security Best Practices

### 1. Never Commit Secrets

**Add to `.gitignore`:**
```
.env
.env.production
.env.local
```

### 2. Use Environment Variables

Never hardcode OAuth credentials in code:
```typescript
// ❌ BAD
const clientId = "Iv1.abc123xyz";

// ✅ GOOD
const clientId = process.env.GITHUB_CLIENT_ID;
```

### 3. Rotate Secrets Regularly

- Rotate OAuth secrets every 90 days
- Rotate `OAUTH_STATE_SECRET` every 30 days

### 4. Monitor OAuth Abuse

Watch for:
- High volume of failed authorizations
- Unusual redirect patterns
- State token validation failures (potential CSRF attacks)

Check audit logs:
```sql
SELECT * FROM "AuditLog"
WHERE action LIKE 'oauth_%'
AND "createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY "createdAt" DESC;
```

### 5. Implement Rate Limiting

Already configured in `workspace/packages/api/src/server.ts`:
- OAuth start endpoints: 5 requests/15min per IP
- OAuth callback endpoints: 5 requests/15min per IP

---

## Testing OAuth Flows

### Manual Test Checklist

**Before deployment:**
- [ ] GitHub OAuth app created
- [ ] LinkedIn OAuth app created (and approved)
- [ ] Environment variables set in `.env.production`
- [ ] Privacy Policy accessible at `/privacy.html`
- [ ] Terms of Service accessible at `/terms.html`

**After deployment:**

**Test 1: GitHub OAuth Happy Path**
1. Onboard a contractor
2. Click "Verify with GitHub"
3. Authorize on GitHub
4. Verify redirect back to app
5. Check verification shows "Verified" badge
6. Check database: `SELECT * FROM "Verification" WHERE type='github' AND status='verified';`

**Test 2: LinkedIn OAuth Happy Path**
1. Onboard a contractor
2. Click "Verify with LinkedIn"
3. Authorize on LinkedIn
4. Verify redirect back to app
5. Check verification shows "Verified" badge
6. Check database: `SELECT * FROM "Verification" WHERE type='linkedin' AND status='verified';`

**Test 3: User Denies Authorization**
1. Start OAuth flow
2. Click "Cancel" on OAuth provider page
3. Verify app handles error gracefully
4. Check verification remains "Pending" (not "Failed")

**Test 4: Expired State Token**
1. Start OAuth flow
2. Wait 16 minutes before authorizing
3. Verify backend returns "Invalid state" error
4. Check audit log has `oauth_state_invalid` entry

**Test 5: Multiple OAuth Attempts**
1. Start OAuth flow 6 times in <15 minutes
2. Verify 6th request returns 429 Too Many Requests
3. Wait 15 minutes and try again (should work)

---

## Production Checklist

Before going live:

- [ ] GitHub OAuth app uses production callback URL
- [ ] LinkedIn OAuth app approved by LinkedIn
- [ ] All environment variables set in production
- [ ] Privacy Policy and Terms of Service published
- [ ] Tested OAuth flows in production environment
- [ ] Rate limiting confirmed working
- [ ] Audit logs capturing OAuth events
- [ ] Error monitoring (Sentry) configured
- [ ] Domain pointing to production server
- [ ] SSL/HTTPS enabled
- [ ] Backup OAuth credentials stored securely (1Password, Vault, etc.)

---

## Support

**If OAuth apps are rejected:**
- **GitHub:** Contact support at https://support.github.com
- **LinkedIn:** Check https://www.linkedin.com/developers/support

**If issues persist:**
- Check logs: `railway logs` or `docker-compose logs api`
- Review audit logs in database
- Test with different browsers/incognito mode
- Verify firewall/network isn't blocking OAuth redirects

**Emergency OAuth Lockout:**
If OAuth credentials are compromised:
1. Immediately regenerate secrets in GitHub/LinkedIn developer portals
2. Update environment variables in production
3. Restart API server
4. Revoke all active sessions
5. Check audit logs for suspicious activity
