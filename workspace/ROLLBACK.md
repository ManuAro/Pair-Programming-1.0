# ROLLBACK & CONTINGENCY PLAN

**Purpose:** What to do when production deployment fails or critical issues emerge

---

## WHEN TO ROLLBACK

Execute rollback if:

❌ **Critical failures:**
- Database migrations failed and data corrupted
- OAuth flow completely broken (0% success rate)
- Security vulnerability discovered
- Service completely down >30 minutes
- Data leak or unauthorized access detected

⚠️ **Consider rollback:**
- >50% of OAuth attempts failing
- Rate limiting too aggressive (blocking legitimate users)
- Credential verification failures >30%
- Multiple user complaints about critical functionality

✅ **DON'T rollback for:**
- Individual user OAuth issues (likely user error)
- <10% failure rate on non-critical features
- Cosmetic bugs
- Performance slowdowns (optimize instead)

---

## ROLLBACK PROCEDURE

### OPTION A: RENDER ROLLBACK (FASTEST - 2 MINUTES)

**Best for:** Service crashes, broken deployments

1. Go to: **https://dashboard.render.com**
2. Select service: `trustlayer-api`
3. Click **"Events"** tab
4. Find last successful deploy (green checkmark)
5. Click **"Rollback to this version"**
6. Confirm rollback
7. Wait 2-3 minutes for redeploy
8. ✅ Service restored to last working version

**Verify rollback:**
```bash
curl https://trustlayer-api.onrender.com/health
# Should return: {"status":"ok"}
```

### OPTION B: GIT REVERT (5 MINUTES)

**Best for:** Bad code merged to main

1. Find bad commit:
```bash
git log --oneline -10
```

2. Revert commit:
```bash
git revert <commit-hash>
git push origin main
```

3. Render auto-deploys reverted code (~3 minutes)

### OPTION C: EMERGENCY PAUSE (30 SECONDS)

**Best for:** Severe security issue, need time to investigate

1. Render dashboard → `trustlayer-api`
2. Click **"Manual Deploy"** dropdown
3. Select **"Suspend"**
4. Service immediately stops accepting traffic
5. ✅ Users see "Service Unavailable" instead of broken functionality

**Resume when fixed:**
- Click **"Resume"**
- Service restarts in ~30 seconds

---

## DATABASE ROLLBACK

### SCENARIO 1: Migration Failed (Database Corrupted)

**If caught immediately (<5 minutes):**

1. Access Render PostgreSQL shell:
```bash
# From Render dashboard → trustlayer-db → Shell
```

2. Check migration status:
```sql
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;
```

3. If last migration status = 'failed', rollback:
```sql
-- Prisma stores migration state, manual rollback risky
-- SAFER: Restore from backup (see below)
```

**Best approach: Restore from backup**

Render automatically backs up PostgreSQL daily (free tier: 7 day retention)

1. Render dashboard → `trustlayer-db`
2. Click **"Backups"** tab
3. Select backup from before failed migration
4. Click **"Restore"** → Creates new database instance
5. Update `DATABASE_URL` in API service env vars
6. Redeploy API service

**⚠️ WARNING:** This loses data created after backup. Only use for critical failures.

### SCENARIO 2: Bad Data (Not Migration Issue)

**Example:** Bug caused contractors to get wrong tiers

**Fix forward (preferred):**
```sql
-- Write corrective SQL query
UPDATE Contractor
SET tier = 'PROVISIONAL'
WHERE tier = 'FULL_CLEARANCE'
  AND (SELECT COUNT(*) FROM Verification WHERE contractorId = Contractor.id) < 5;
```

**Don't restore from backup unless data is irrecoverable.**

---

## OAUTH ROLLBACK

### SCENARIO: GitHub OAuth Broken After Deploy

**Quick Fixes (try first):**

1. **Callback URL mismatch:**
```bash
# Check env var
echo $OAUTH_CALLBACK_BASE_URL
# Should match: https://trustlayer-api.onrender.com

# Fix in Render dashboard → Environment
# Update OAUTH_CALLBACK_BASE_URL
# Redeploy
```

2. **Invalid credentials:**
```bash
# Verify Client ID/Secret in Render env match GitHub OAuth app
# If wrong, update and redeploy
```

3. **State token issues:**
```bash
# Check logs for "State mismatch" errors
# Likely user took >15 min to authorize
# Not a bug - expected behavior
```

**If unfixable:** Temporarily disable OAuth

```bash
# Render dashboard → Environment
TEST_MODE=true  # Simulates OAuth success
# Redeploy (2 minutes)
# Users can onboard without real OAuth while you debug
```

**⚠️ Mark TEST_MODE credentials clearly so users know they're not real**

---

## ENV VAR ROLLBACK

### SCENARIO: Bad Env Var Broke Production

**Example:** Accidentally set `TEST_MODE=true` in production

**Fix (1 minute):**

1. Render dashboard → `trustlayer-api` → Environment
2. Find bad env var
3. Update to correct value
4. Click **"Save Changes"**
5. Service auto-redeploys (~2 minutes)

**Verify:**
```bash
curl https://trustlayer-api.onrender.com/health
# Check logs confirm new env var active
```

---

## COMMUNICATION PLAN

### INTERNAL (Team Communication)

**Immediately when rolling back:**
```
🚨 PRODUCTION ISSUE - ROLLBACK IN PROGRESS

Issue: [brief description]
Action: [rollback method used]
ETA: [time to resolution]
Status updates: Every 15 min

- Claude/Codex
```

### EXTERNAL (User Communication)

**If service down >10 minutes:**

Post on status page or social:
```
We're experiencing technical difficulties. Service temporarily unavailable while we fix the issue.

ETA: 15 minutes

We apologize for the inconvenience.
```

**After resolution:**
```
✅ Service restored. Issue resolved.

What happened: [brief, honest explanation]
Impact: [X users affected, Y minutes downtime]
Prevention: [what we're doing to prevent recurrence]

Thanks for your patience!
```

**DON'T:**
- ❌ Blame users
- ❌ Provide excuses
- ❌ Hide the issue
- ❌ Overpromise ("this will never happen again")

**DO:**
- ✅ Be transparent
- ✅ Own the mistake
- ✅ Explain what you're doing to prevent it
- ✅ Thank users for patience

---

## POST-ROLLBACK CHECKLIST

After successful rollback:

- [ ] Verify service is fully operational (run SMOKE_TEST.sh)
- [ ] Check database integrity (query key tables)
- [ ] Review logs for secondary issues
- [ ] Document incident (what happened, why, how fixed)
- [ ] Create GitHub issue for root cause fix
- [ ] Write test to prevent regression
- [ ] Update monitoring/alerts to catch issue faster next time
- [ ] Communicate with affected users if needed

---

## PREVENTION > ROLLBACK

**Better than rolling back: Don't deploy broken code**

### Pre-deploy Checklist

✅ All tests passing locally
✅ Smoke test passed on local
✅ Env vars double-checked
✅ Database migrations tested locally
✅ OAuth tested end-to-end locally (LOCAL_OAUTH_DRILL.md)
✅ Rate limits configured (not disabled)
✅ TEST_MODE=false

### Staged Rollout (Future Enhancement)

**Phase 1:** Deploy to staging environment first
**Phase 2:** Test with synthetic users
**Phase 3:** Deploy to production
**Phase 4:** Monitor for 1 hour before announcing

---

## CONTACT FOR EMERGENCIES

**Production is down and you need help:**

1. Check Render status: https://status.render.com
2. Check GitHub OAuth status: https://www.githubstatus.com
3. Review logs in Render dashboard
4. If database issue, check Render PostgreSQL dashboard
5. Last resort: Suspend service, investigate offline

**Database restore support:**
- Render docs: https://render.com/docs/databases#backups
- Support: help@render.com (response time: hours to days for free tier)

---

## WORST CASE SCENARIOS

### SCENARIO: Complete Database Loss

**If Render database permanently lost:**

1. **Accept data loss** (no external backups on free tier)
2. Create new database
3. Run migrations fresh
4. Redeploy service
5. **All contractors must re-verify** (unavoidable)

**Prevention:**
- Export database daily to CSV (manual)
- Upgrade to paid tier for better backups
- Implement external backup solution (future)

### SCENARIO: Credentials Leaked (GitHub OAuth Secret Exposed)

**Immediate actions (5 minutes):**

1. Suspend Render service (stop traffic)
2. Revoke GitHub OAuth app (GitHub settings → OAuth app → Revoke)
3. Create new GitHub OAuth app
4. Update env vars with new credentials
5. Resume service

**Impact:** All users must re-authorize GitHub (one-time)

### SCENARIO: TrustLayer Account Compromised

**If someone gains access to Render/GitHub accounts:**

1. Change all passwords immediately
2. Enable 2FA on all accounts
3. Revoke all OAuth apps
4. Review audit logs for unauthorized changes
5. Notify affected users
6. Consider creating new infrastructure (worst case)

---

## ROLLBACK TESTING

**Practice rollback before you need it:**

1. Deploy a intentionally broken version to staging
2. Execute rollback procedure
3. Time how long it takes
4. Document any issues
5. Update this runbook

**Goal:** Rollback should be muscle memory, not panic-driven debugging

---

## KEY TAKEAWAYS

✅ **Rollback is not failure** - it's smart risk management
✅ **Fast rollback > perfect rollback** - 2 min rollback beats 30 min debugging
✅ **Communicate clearly** - users appreciate honesty
✅ **Learn and iterate** - every incident makes you stronger
✅ **Prevention is best** - test thoroughly before deploy

---

**IN CASE OF EMERGENCY, STAY CALM. THIS RUNBOOK HAS YOU COVERED.**
