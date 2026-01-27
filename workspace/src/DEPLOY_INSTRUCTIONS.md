# DEPLOYMENT INSTRUCTIONS - Contractor Passport Landing

## IMMEDIATE NEXT STEPS (In Order)

### 1. Deploy to Netlify (10 minutes)

**Option A: Netlify Drop (Fastest - No CLI needed)**
1. Go to: https://app.netlify.com/drop
2. Create free Netlify account if needed
3. Drag and drop the entire `workspace/src/landing` folder
4. Get your live URL (e.g., `random-name-12345.netlify.app`)
5. **DONE!** Site is live and forms are working.

**Option B: Netlify CLI**
```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Navigate to landing directory
cd workspace/src/landing

# Login (opens browser)
netlify login

# Deploy to production
netlify deploy --prod

# Follow prompts:
# - Create & configure new site: YES
# - Publish directory: . (current directory)
```

### 2. Configure Form Notifications (5 minutes)

After deployment:
1. Go to Netlify Dashboard → Your Site → Forms
2. You should see 2 forms: "company" and "contractor"
3. Click "Form notifications"
4. Add email notification to: `pilot@contractorpassport.com`
5. (Optional) Setup Slack webhook for instant alerts

**Test the forms:**
- Visit your live site
- Submit both forms with test data
- Check that you receive emails

### 3. Setup Analytics (5 minutes)

**Recommended: Plausible Analytics (Privacy-first, GDPR compliant)**
1. Sign up at https://plausible.io (free 30-day trial, then $9/mo)
2. Add your domain
3. Get your tracking script
4. Uncomment and update line 30 in `index.html`:
   ```html
   <script defer data-domain="YOUR-DOMAIN.netlify.app" src="https://plausible.io/js/script.js"></script>
   ```
5. Redeploy: `netlify deploy --prod`

**Alternative: Netlify Analytics**
- Site Settings → Analytics → Enable ($9/mo)
- No code changes needed
- Slightly less detailed but automatic

### 4. Custom Domain (Optional - 15 minutes)

If you want `contractorpassport.com`:
1. Buy domain at Namecheap/Google Domains (~$12/year)
2. In Netlify: Site Settings → Domain Management → Add custom domain
3. Point DNS records (Netlify shows exact instructions)
4. Wait 5-60 minutes for DNS propagation
5. SSL certificate is automatic

---

## SUCCESS CRITERIA FOR GO/NO-GO (Next 2 weeks)

Track these metrics to validate demand:

### ✅ GO Signal (Build full MVP)
- **≥30 company form submissions** in 2 weeks
- **≥3 companies** explicitly request pilot/demo
- **<60% bounce rate** (people are reading, not leaving immediately)
- **≥2 min avg time on site** (engaged visitors)

### ❌ PIVOT Signal (Problem not validated)
- **<10 company submissions** in 2 weeks
- **>80% bounce rate** (wrong messaging or wrong audience)
- **All leads are contractors, zero companies** (wrong wedge - should be demand-first)
- **Zero replies to outreach emails** (pain not acute)

### 🟡 ITERATE Signal (Promising but needs refinement)
- **10-29 company submissions** (interest exists but messaging needs work)
- **50%+ traffic from one source** (need to diversify channels)
- **High traffic, low conversions** (CTA or form friction issue)

---

## OUTREACH PLAN (Start Day 1 after deploy)

### Week 1: Warm Outreach (Personal, High-Touch)

**Goal:** 20 conversations with target customers

**LinkedIn DM Script:**
```
Hi [Name],

I'm researching friction in remote contractor verification for fintech/healthtech companies. I noticed [company] is hiring [evidence from their job board].

Not selling anything yet — just trying to understand how long your last contractor took to clear background checks, and if that's a pain point.

Would you spare 15 minutes this week? Happy to share findings from other companies.

[Your name]
P.S. If you're drowning in verification delays right now, I'm building something that might help: [link]
```

**Target List:**
- 10 fintech CTOs/Heads of Eng (find on LinkedIn, filter by "hiring")
- 5 healthtech CTOs
- 5 compliance/security heads at regulated companies

**Channels:**
- LinkedIn (primary)
- Twitter DMs (if active in tech)
- Email (use Hunter.io to find emails)

---

### Week 2: Community Launch (Broadcast, Low-Touch)

**HackerNews - Show HN Post:**
```
Show HN: Verify contractors in 24 hours (vs 6 weeks)

We're building a "passport" that lets contractors verify once (identity, background, technical skills) and reuse it across jobs.

The wedge is fintech/healthtech teams that can't start projects because international background checks take 8-30 days.

Landing page: [link]
Looking for: 2-3 pilot companies to test with

Happy to answer questions about how verification works, pricing, or the technical architecture.
```

**Post timing:** Tuesday-Thursday, 8-11am PT (best HN traffic)

**Reddit:**
- r/forhire - "Contractors: Get verified once, work anywhere"
- r/startups - Ask: "How long did your last contractor take to clear?"
- r/fintech - Problem-focused discussion

**IndieHackers:**
- Post in "Product Launches" + "Looking for Beta Users"
- Emphasize: $5.1B market, clear pain point, looking for feedback

---

### Week 3-4: Paid Validation (If organic shows promise)

**LinkedIn Ads Test:**
- Budget: $500 ($25/day for 20 days)
- Audience: CTOs, Heads of Engineering, Compliance at fintech/healthtech 50-500 employees
- Creative: "Still waiting 6 weeks to onboard contractors? [Company Name] cuts it to 24 hours."
- CTA: "Request Pilot"

**Success:** Cost per company lead <$50 → scalable acquisition channel

---

## TECH STACK DECISIONS MADE

✅ **Hosting:** Netlify (free tier sufficient for MVP)
✅ **Forms:** Netlify Forms (automatic, no backend)
✅ **Analytics:** Plausible (privacy-first, GDPR compliant)
✅ **Domain:** TBD (can use .netlify.app subdomain for validation)
✅ **Email notifications:** Netlify → Email (free)

**Why this stack:**
- $0-18/mo total cost
- Deploys in 10 minutes
- No backend to maintain
- Scales to 100K visitors/mo without changes
- Privacy-compliant (GDPR/CCPA ready)

---

## VALIDATION TRACKING

Created: `workspace/src/metrics_tracker.csv` (update daily)

Track:
- Date
- Page views (total)
- Unique visitors
- Company form submissions
- Contractor form submissions
- Bounce rate
- Avg time on site
- Traffic sources (LinkedIn, HN, Reddit, Direct)
- Outreach sent (DMs/emails)
- Responses received

**Review every Friday:** Are we hitting GO/NO-GO criteria?

---

## DEPLOYMENT CHECKLIST

Before announcing publicly:

- [ ] Site deployed to Netlify
- [ ] Both forms tested and working
- [ ] Email notifications configured
- [ ] Analytics tracking installed
- [ ] Mobile tested (iPhone + Android)
- [ ] Load speed <3s (test with PageSpeed Insights)
- [ ] All links work (Problem, Solution, Pricing, Pilot)
- [ ] SSL enabled (should be automatic)
- [ ] OG image created (optional but good for social shares)
- [ ] Typos checked
- [ ] Legal pages NOT needed for MVP (can add later)

---

## EMERGENCY CONTACTS / RESOURCES

**Netlify Support:** https://www.netlify.com/support/
**Plausible Docs:** https://plausible.io/docs
**Form Testing Tool:** https://www.netlify.com/products/forms/

**If forms break:**
1. Check Netlify dashboard → Forms → Are they detected?
2. Ensure `name` attribute and hidden `form-name` input match
3. Deploy must be successful (check deploy logs)

**If analytics not tracking:**
1. Check browser console for errors
2. Verify script domain matches your actual domain
3. Try incognito mode (ad blockers may interfere)

---

## NEXT MILESTONE AFTER VALIDATION

**If GO signal (≥30 company leads):**
→ Build functional MVP:
  - Contractor onboarding flow
  - KYC integration (Persona/Onfido)
  - GitHub verification
  - Passport generation with crypto signatures
  - Employer verification portal

**Budget for full MVP:** ~6-8 weeks engineering time

**If PIVOT signal:**
→ Analyze why:
  - Wrong wedge? (Try different segment: contractors → crypto, agencies → staffing firms)
  - Wrong pain? (Go back to pitch battle, round 2)
  - Wrong timing? (Market not ready)

---

## QUESTIONS FOR REVIEW

After 2 weeks of running the experiment, answer:

1. **Did we get 30+ company leads?** (GO/NO-GO)
2. **What traffic source performed best?** (Double down)
3. **What feedback did we get?** (Iterate messaging)
4. **Did anyone ask about features we don't mention?** (Uncover hidden needs)
5. **What objections came up repeatedly?** (Address in V2)

---

**CURRENT STATUS:** Landing page built, ready to deploy.
**NEXT ACTION:** Deploy to Netlify (Option A recommended: Netlify Drop)
**TIME TO FIRST DATA:** <1 hour after deployment + outreach starts
