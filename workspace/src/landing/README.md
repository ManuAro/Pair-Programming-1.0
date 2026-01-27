# Contractor Passport - Landing Page

## Quick Deploy to Netlify

### Option 1: Netlify CLI (Recommended)
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Navigate to landing directory
cd workspace/src/landing

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

### Option 2: Netlify Drop
1. Go to https://app.netlify.com/drop
2. Drag and drop the entire `landing` folder
3. Done! Your site is live.

### Option 3: Git-based Deploy
1. Push this repo to GitHub
2. Connect to Netlify
3. Set build settings:
   - Base directory: `workspace/src/landing`
   - Build command: (leave empty)
   - Publish directory: `.`

## Form Setup (Netlify Forms)

The forms are already configured with `name` attributes and hidden `form-name` inputs.

**After deploying**, Netlify will automatically:
- Detect the two forms: `company` and `contractor`
- Create form submission endpoints
- Store submissions in Netlify dashboard

**To receive notifications:**
1. Go to Site Settings → Forms → Form notifications
2. Add email notification to: `pilot@contractorpassport.com`
3. (Optional) Setup Slack/Zapier webhooks for real-time alerts

## Analytics Setup

### Netlify Analytics (Recommended - Privacy-first)
1. Site Settings → Analytics → Enable Netlify Analytics ($9/mo)
2. No code changes needed
3. Tracks: page views, unique visitors, popular pages, sources

### Google Analytics (Alternative)
Add before closing `</head>` tag in `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

Replace `GA_MEASUREMENT_ID` with your tracking ID.

### Plausible (Alternative - Privacy-focused)
Add before closing `</head>` tag:

```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

## Success Metrics to Track

**Primary KPIs (first 2 weeks):**
- Company form submissions (target: 30+)
- Contractor form submissions (target: 50+)
- Bounce rate (<60% is good)
- Time on site (>2 min is engaged)

**Secondary:**
- Traffic sources (where do pilots come from?)
- Section engagement (Problem, Pricing, FAQ scroll depth)
- CTA click-through rates

## Custom Domain Setup

1. Buy domain: `contractorpassport.com` (Namecheap, Google Domains)
2. In Netlify: Site Settings → Domain Management → Add custom domain
3. Follow DNS setup instructions
4. SSL certificate is automatic (Let's Encrypt)

## A/B Testing Ideas (after first 100 visitors)

Test these variations:
- Headline: "24 hours" vs "Same day"
- Pricing: Show pilot discount vs hide discount
- CTA: "Request Pilot" vs "Start Free Trial"
- Social proof: Add customer logos (once we have them)

## Pre-Launch Checklist

- [ ] Forms submit successfully (test both forms)
- [ ] All links work
- [ ] Mobile responsive (test on phone)
- [ ] Page loads fast (<3s)
- [ ] SEO: Title, description, OG tags
- [ ] Analytics tracking code added
- [ ] Form notifications configured
- [ ] Custom domain pointed (optional)
- [ ] SSL enabled
- [ ] Lighthouse score >90

## Outreach Plan (Post-Deploy)

**Week 1: Warm outreach**
- LinkedIn DMs to 20 fintech CTOs/Heads of Eng
- Use the script from `interview_guide.md`
- Share landing page link

**Week 2: Community launch**
- Post on HackerNews (Show HN: Verify contractors in 24h)
- r/forhire, r/entrepreneur
- IndieHackers

**Week 3-4: Paid validation**
- LinkedIn ads targeting fintech/healthtech CTOs
- Budget: $500 test
- Track cost-per-lead

## File Structure
```
landing/
├── index.html          # Main landing page
├── styles.css          # All styles
├── script.js           # Scroll animations
├── netlify.toml        # Netlify config
└── README.md           # This file
```

## Notes
- No backend needed for MVP
- Netlify Forms handles submissions
- Analytics track validation metrics
- Static site = fast, cheap, reliable
