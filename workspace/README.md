# Contractor Passport

**Portable, cryptographically verifiable professional credentials for independent contractors.**

---

## Problem

Independent contractors lose all verification work when moving between platforms (Upwork → Toptal → direct clients). Every new platform requires re-verification: identity checks, background checks, references. This costs time ($249 × 5 verifications) and creates artificial platform lock-in.

## Solution

**Contractor Passport** is a portable credential system where contractors verify ONCE and carry cryptographically-signed credentials across platforms. Think "TSA PreCheck for the gig economy."

### Two-Tier System
- **PROVISIONAL** (24h validity): Basic identity + GitHub + LinkedIn → Fast onboarding
- **FULL_CLEARANCE** (90-day validity): + Background check + 2 references → Maximum trust

---

## Tech Stack

**Backend (API)**
- Node.js + Express + TypeScript
- PostgreSQL (production) / SQLite (development)
- Prisma ORM
- JWT with RSA-256 (JWKS for public key distribution)
- Rate limiting (express-rate-limit)
- Security hardening (helmet.js, CORS)
- Structured logging (pino)
- Error monitoring (Sentry)

**Frontend (Web)**
- React + TypeScript
- Vite build system
- TailwindCSS

**Infrastructure**
- Docker Compose for orchestration
- Redis for caching/rate-limiting
- Nginx for reverse proxy (optional)

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for production)
- PostgreSQL (for production) or SQLite (auto-created in dev)

### Development

```bash
# Clone repository
git clone https://github.com/yourorg/contractor-passport.git
cd contractor-passport/workspace

# Install dependencies
npm install

# Start API (port 3001)
npm run dev:api

# Start Web (port 3000) in another terminal
npm run dev:web

# Open browser
open http://localhost:3000
```

### Production Deployment

See [DEPLOY.md](./DEPLOY.md) for comprehensive deployment instructions.

**Quick deploy with Docker Compose:**

```bash
# Copy environment template
cp .env.production.example .env.production
nano .env.production  # Fill in values

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Verify
curl http://localhost:3001/health
```

---

## API Documentation

### Core Endpoints

#### **Health Check**
```
GET /health
```
Returns API status and timestamp.

#### **Onboarding**
```
POST /api/contractors/onboard
Body: { name: string, email: string }
```
Creates new contractor account.

#### **Create Verification**
```
POST /api/contractors/:id/verifications
Body: { type: 'identity' | 'github' | 'linkedin' | 'background_check' | 'reference', provider?: string }
```
Initiates a verification.

#### **Update Verification**
```
PATCH /api/verifications/:id
Body: { status: 'verified' | 'failed', data?: object }
```
Marks verification as completed.

#### **Issue Credential**
```
POST /api/contractors/:id/credentials
```
Issues a JWT credential based on completed verifications.

#### **Verify Credential**
```
GET /api/credentials/:id/verify
```
Public endpoint to verify a credential's validity.

#### **Revoke Credential**
```
POST /api/credentials/:id/revoke
Body: { reason?: string, actor?: string }
```
Revokes a credential (security incident, contractor request, etc.)

#### **Check Credential Status**
```
GET /api/credentials/:id/status
```
Returns credential status (valid, expired, revoked).

#### **JWKS Endpoint**
```
GET /.well-known/jwks.json
```
Public key for JWT verification (JWK format).

---

## Project Structure

```
workspace/
├── packages/
│   ├── api/                    # Backend API
│   │   ├── src/
│   │   │   ├── server.ts       # Main Express app
│   │   │   ├── crypto/         # RSA key management
│   │   │   ├── middleware/     # Rate limiting, error handling
│   │   │   ├── monitoring/     # Sentry integration
│   │   │   └── utils/          # Logger, helpers
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── Dockerfile          # Production container
│   │
│   ├── web/                    # Frontend React app
│   │   ├── src/
│   │   │   └── App.tsx         # Main component
│   │   ├── nginx.conf          # Production Nginx config
│   │   └── Dockerfile          # Production container
│   │
│   └── shared/                 # Shared types (future)
│
├── tests/
│   ├── e2e.test.ts             # End-to-end test suite
│   └── run-e2e.sh              # Test runner script
│
├── docker-compose.prod.yml     # Production orchestration
├── .env.production.example     # Environment variables template
├── DEPLOY.md                   # Deployment guide
└── README.md                   # This file
```

---

## Security Features

### Implemented
- ✅ **JWT with RSA-256**: Cryptographically signed credentials
- ✅ **JWKS Endpoint**: Public key distribution for verification
- ✅ **Key Persistence**: RSA keys survive server restarts
- ✅ **Rate Limiting**: Prevents abuse and DOS attacks
- ✅ **Helmet.js**: Security headers (CSP, X-Frame-Options, etc.)
- ✅ **CORS Configuration**: Restrict API access by origin
- ✅ **Audit Logging**: Every action is logged for forensics
- ✅ **Credential Revocation**: Emergency invalidation system
- ✅ **Input Validation**: Zod schemas for all endpoints
- ✅ **Structured Logging**: JSON logs for security analysis

### Planned
- [ ] **OAuth Integration**: GitHub/LinkedIn real authentication
- [ ] **MFA**: Two-factor authentication for contractors
- [ ] **Webhook Signatures**: HMAC signing for callbacks
- [ ] **IP Whitelisting**: Restrict admin endpoints
- [ ] **Session Management**: JWT refresh tokens
- [ ] **Encryption at Rest**: Database column encryption for PII

---

## Testing

### E2E Tests

```bash
cd workspace/tests
./run-e2e.sh
```

**Test Coverage:**
- Contractor onboarding
- Verification creation and completion
- PROVISIONAL credential issuance
- FULL_CLEARANCE credential issuance
- Credential verification
- Credential revocation
- Key persistence across restarts
- Error handling

### Manual Testing

```bash
# 1. Onboard contractor
curl -X POST http://localhost:3001/api/contractors/onboard \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

# 2. Create verifications (use contractor ID from step 1)
CONTRACTOR_ID="..."
curl -X POST http://localhost:3001/api/contractors/$CONTRACTOR_ID/verifications \
  -H "Content-Type: application/json" \
  -d '{"type":"identity","provider":"persona"}'

# 3. Mark verification as verified (use verification ID)
VERIFICATION_ID="..."
curl -X PATCH http://localhost:3001/api/verifications/$VERIFICATION_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"verified"}'

# 4. Issue credential
curl -X POST http://localhost:3001/api/contractors/$CONTRACTOR_ID/credentials

# 5. Verify credential (use credential ID)
CREDENTIAL_ID="..."
curl http://localhost:3001/api/credentials/$CREDENTIAL_ID/verify
```

---

## Monitoring & Observability

### Logs

```bash
# Development (pretty-printed)
npm run dev:api

# Production (JSON structured)
docker-compose -f docker-compose.prod.yml logs -f api

# Search logs
docker-compose -f docker-compose.prod.yml logs api | grep "ERROR"
```

### Metrics

Key metrics to monitor:
- **API Response Time**: P50, P95, P99
- **Error Rate**: 4xx and 5xx responses
- **Credential Issuance**: Successful vs failed
- **Rate Limit Hits**: Potential abuse
- **Database Connections**: Connection pool usage

### Sentry Integration

Set `SENTRY_DSN` environment variable to enable:
- Automatic error capture
- Performance tracing
- Breadcrumb trails
- User context

---

## Roadmap

### Phase 1: MVP ✅ (Completed)
- [x] Core credential system (issue, verify, revoke)
- [x] Two-tier system (PROVISIONAL, FULL_CLEARANCE)
- [x] E2E test suite
- [x] Production deployment config
- [x] Security hardening
- [x] Monitoring setup

### Phase 2: Real Integrations (In Progress)
- [ ] GitHub OAuth (real authentication)
- [ ] LinkedIn OAuth (real authentication)
- [ ] Checkr API (background checks)
- [ ] SendGrid (email verification for references)
- [ ] Stripe (payment processing)

### Phase 3: Employer Platform
- [ ] Employer dashboard
- [ ] Bulk credential verification
- [ ] Webhook integration
- [ ] API keys for platforms
- [ ] Usage analytics

### Phase 4: Scale
- [ ] Multi-region deployment
- [ ] CDN for static assets
- [ ] Read replicas for database
- [ ] Redis cluster for distributed rate limiting
- [ ] Elasticsearch for audit log search

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Copyright © 2026 Contractor Passport. All rights reserved.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourorg/contractor-passport/issues)
- **Documentation**: See `DEPLOY.md` for deployment help
- **Contact**: founders@contractorpassport.com

---

## Founders

Built by **Claude** and **Codex** as a pair-programming experiment that became real.

**This is NOT an exercise. This changes the world.** 🚀
