# OAuth Integration Setup Guide

This guide explains how to set up real OAuth integrations for GitHub and LinkedIn in production.

## Overview

The system uses OAuth 2.0 to verify contractor GitHub and LinkedIn profiles. The flow:
1. User clicks "Verify with GitHub/LinkedIn" in the UI
2. Backend generates a signed state token and redirects to provider
3. Provider redirects back to our callback URL with authorization code
4. Backend exchanges code for access token and fetches profile
5. Backend marks verification as "verified" and redirects user back to UI

## GitHub OAuth Setup

### 1. Create GitHub OAuth App

Go to: https://github.com/settings/developers

Click **"New OAuth App"** and configure:
- **Application name**: Contractor Passport (or your company name)
- **Homepage URL**: `https://yourdomain.com`
- **Authorization callback URL**: `https://yourdomain.com/api/oauth/github/callback`

After creation, note down:
- **Client ID** (public)
- **Client Secret** (keep secret!)

### 2. Set Environment Variables

Add to your `.env.production`:

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_CALLBACK_URL=https://yourdomain.com/api/oauth/github/callback
GITHUB_SCOPES="read:user user:email"
```

**Scopes explained:**
- `read:user` - Read basic profile information
- `user:email` - Read email addresses (needed to verify identity)

### 3. Test the Flow

1. Create a contractor account
2. Click "Verify with GitHub" button
3. Authorize the app on GitHub
4. You should be redirected back with verification complete

## LinkedIn OAuth Setup

### 1. Create LinkedIn App

Go to: https://www.linkedin.com/developers/apps

Click **"Create app"** and configure:
- **App name**: Contractor Passport
- **LinkedIn Page**: Create or use existing company page
- **App logo**: Upload logo (required)
- **Privacy policy URL**: `https://yourdomain.com/privacy`
- **Legal terms URL**: `https://yourdomain.com/terms`

After creation:
1. Go to **"Auth"** tab
2. Add **OAuth 2.0 redirect URLs**: `https://yourdomain.com/api/oauth/linkedin/callback`
3. Note down **Client ID** and **Client Secret**

### 2. Request Access to Products

In the **"Products"** tab, request access to:
- ✅ **Sign In with LinkedIn using OpenID Connect** (REQUIRED)

Wait for approval (usually instant for "Sign In with LinkedIn").

### 3. Set Environment Variables

Add to your `.env.production`:

```bash
# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
LINKEDIN_CALLBACK_URL=https://yourdomain.com/api/oauth/linkedin/callback
LINKEDIN_SCOPES="openid profile email"
```

**Scopes explained:**
- `openid` - OpenID Connect authentication
- `profile` - Basic profile (name, profile picture)
- `email` - Email address

### 4. Test the Flow

1. Create a contractor account
2. Click "Verify with LinkedIn" button
3. Authorize the app on LinkedIn
4. You should be redirected back with verification complete

## Security Configuration

### OAuth State Secret

The system signs OAuth state tokens using HMAC-SHA256. Set a strong secret:

```bash
OAUTH_STATE_SECRET=generate_random_256_bit_secret_here
```

Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Web Base URL

Set the public URL of your web application:

```bash
WEB_BASE_URL=https://yourdomain.com
```

This is used for:
- Validating `returnTo` redirects (prevents open redirect attacks)
- Constructing verification links

## Environment Variables Reference

Complete OAuth environment variables:

```bash
# OAuth State Security
OAUTH_STATE_SECRET=your_256_bit_secret_here
OAUTH_STATE_ISSUER=contractor-passport-oauth
WEB_BASE_URL=https://yourdomain.com

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://yourdomain.com/api/oauth/github/callback
GITHUB_SCOPES="read:user user:email"

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_CALLBACK_URL=https://yourdomain.com/api/oauth/linkedin/callback
LINKEDIN_SCOPES="openid profile email"
```

## Local Development Setup

For local testing, use `localhost`:

```bash
# Local dev URLs
WEB_BASE_URL=http://localhost:5173
GITHUB_CALLBACK_URL=http://localhost:3001/api/oauth/github/callback
LINKEDIN_CALLBACK_URL=http://localhost:3001/api/oauth/linkedin/callback
```

**Important:** You need to create separate OAuth apps for local development with `localhost` callback URLs, as GitHub and LinkedIn don't allow multiple callback URLs per app in different domains.

## Troubleshooting

### "Invalid state" error

**Cause:** OAuth state token expired (15 min TTL) or signature verification failed.

**Solution:**
1. Check `OAUTH_STATE_SECRET` is set and consistent
2. Ensure system clocks are synchronized (JWT exp validation)
3. User may have taken >15 min to authorize - ask them to retry

### "Verification not found" error

**Cause:** Verification record doesn't exist in database.

**Solution:**
1. Check verification was created before OAuth flow started
2. Verify database is accessible
3. Check audit logs for the verification ID

### "Invalid redirect_uri" error from provider

**Cause:** Callback URL mismatch between OAuth app config and environment variable.

**Solution:**
1. Check callback URL in provider's dashboard matches `*_CALLBACK_URL` env var EXACTLY
2. URL must include protocol (https://)
3. No trailing slashes

### User stuck on "Pending" after OAuth

**Cause:** Backend callback failed but user was redirected.

**Solution:**
1. Check backend logs for errors during OAuth callback
2. Verify database write permissions
3. Check network connectivity to GitHub/LinkedIn APIs
4. Verify scopes are sufficient for the API calls

## API Documentation

The OAuth endpoints are documented in Swagger UI at:
- **Local**: http://localhost:3001/api/docs
- **Production**: https://yourdomain.com/api/docs

Endpoints:
- `GET /api/oauth/github/start?contractorId=...&returnTo=...`
- `GET /api/oauth/github/callback?code=...&state=...`
- `GET /api/oauth/linkedin/start?contractorId=...&returnTo=...`
- `GET /api/oauth/linkedin/callback?code=...&state=...`

## Rate Limits

OAuth endpoints are protected by rate limiting:
- **5 requests per 15 minutes** per IP address

This prevents abuse while allowing legitimate retry attempts.

## Audit Trail

All OAuth verifications are logged:
- Action: `oauth_github_verified` or `oauth_linkedin_verified`
- Actor: `system`
- Metadata: `{ verificationId, timestamp }`

Query audit logs:
```sql
SELECT * FROM AuditLog
WHERE action LIKE 'oauth_%'
ORDER BY createdAt DESC;
```

## Next Steps

After OAuth is working:
1. ✅ Test with real accounts (yours)
2. ✅ Monitor audit logs for errors
3. ✅ Set up Sentry for error tracking
4. ✅ Create privacy policy and terms of service (required for LinkedIn)
5. ✅ Request production access from LinkedIn (if needed)
6. ✅ Test rate limiting behavior
7. ✅ Set up monitoring for OAuth callback failures
