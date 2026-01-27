# Deployment Guide - Contractor Passport

## Production Deployment Checklist

### Pre-Deployment

- [ ] **Environment Variables**: Copy `.env.production.example` to `.env.production` and fill all values
- [ ] **Database Backups**: Setup automated PostgreSQL backups
- [ ] **SSL Certificates**: Obtain SSL certificates (Let's Encrypt recommended)
- [ ] **Domain**: Point DNS to your server
- [ ] **Sentry**: Create project at sentry.io and add DSN to env
- [ ] **Secrets Rotation**: Generate strong passwords for PostgreSQL and Redis
- [ ] **OAuth Apps**: Register GitHub and LinkedIn OAuth applications (see [OAUTH_SETUP.md](./OAUTH_SETUP.md))

### Deployment Options

## Option 1: Docker Compose (Recommended for VPS/Self-Hosted)

### Requirements
- Docker 24+ and Docker Compose 2+
- 2GB+ RAM, 2+ CPU cores
- 20GB+ disk space

### Steps

1. **Clone repository on server**
   ```bash
   git clone https://github.com/yourorg/contractor-passport.git
   cd contractor-passport/workspace
   ```

2. **Configure environment**
   ```bash
   cp .env.production.example .env.production
   nano .env.production  # Fill in all required values
   ```

3. **Build and start services**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Run database migrations**
   ```bash
   docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
   ```

5. **Verify deployment**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3000/
   ```

6. **Check logs**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f api
   ```

### Updating

```bash
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

---

## Option 2: Railway (Recommended for Quick Deploy)

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### Manual Deploy

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create new project**
   ```bash
   railway init
   ```

3. **Add PostgreSQL**
   ```bash
   railway add postgresql
   ```

4. **Add Redis**
   ```bash
   railway add redis
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Set environment variables** in Railway dashboard
   - Go to project settings
   - Add all variables from `.env.production.example`

---

## Option 3: Render

1. **Create account at render.com**

2. **Create PostgreSQL database**
   - New → PostgreSQL
   - Note the connection string

3. **Create Redis instance**
   - New → Redis
   - Note the connection string

4. **Deploy API**
   - New → Web Service
   - Connect GitHub repo
   - Build command: `cd workspace/packages/api && npm install && npx prisma generate && npm run build`
   - Start command: `cd workspace/packages/api && node dist/server.js`
   - Add environment variables

5. **Deploy Web**
   - New → Static Site
   - Build command: `cd workspace/packages/web && npm install && npm run build`
   - Publish directory: `workspace/packages/web/dist`

---

## Option 4: Fly.io

### API Deployment

```bash
cd workspace/packages/api
fly launch --name contractor-passport-api
fly postgres create --name contractor-passport-db
fly redis create --name contractor-passport-redis
fly secrets set DATABASE_URL=... REDIS_URL=... SENTRY_DSN=...
fly deploy
```

### Web Deployment

```bash
cd workspace/packages/web
fly launch --name contractor-passport-web
fly secrets set VITE_API_URL=https://contractor-passport-api.fly.dev
fly deploy
```

---

## Post-Deployment

### 1. SSL/HTTPS Setup

#### With Nginx (Docker Compose)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (add to crontab)
0 12 * * * /usr/bin/certbot renew --quiet
```

#### With Cloudflare (Recommended)
1. Point DNS to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Enable "Always Use HTTPS"
4. Enable "Auto Minify" for JS/CSS/HTML

### 2. Monitoring Setup

#### Sentry (Error Tracking)
1. Create project at sentry.io
2. Copy DSN to `SENTRY_DSN` env var
3. Test: Trigger an error and check Sentry dashboard

#### Uptime Monitoring
- Use UptimeRobot or Pingdom
- Monitor `/health` endpoint
- Alert on downtime

#### Performance Monitoring
```bash
# Add to Docker Compose for Prometheus + Grafana
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Backups

#### PostgreSQL Backups
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M)
docker exec contractor-passport-db pg_dump -U contractor_passport contractor_passport | gzip > backup-$DATE.sql.gz

# Keep last 30 days
find . -name "backup-*.sql.gz" -mtime +30 -delete
```

#### Automated Backups (cron)
```bash
0 2 * * * /path/to/backup-script.sh
```

### 4. Security Hardening

#### Firewall (UFW)
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

#### Fail2Ban (Brute Force Protection)
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

#### Regular Updates
```bash
# Auto security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Add Nginx/HAProxy in front of multiple API instances
2. **Database**: Use read replicas for read-heavy workloads
3. **Redis**: Use Redis Cluster for distributed rate limiting
4. **CDN**: Serve static assets via CloudFlare or AWS CloudFront

### Vertical Scaling

- Start: 2GB RAM, 2 CPU cores
- Growth: 4GB RAM, 4 CPU cores
- Scale: 8GB+ RAM, 8+ CPU cores

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_verifications_contractor_type ON "Verification" ("contractorId", "type");
CREATE INDEX idx_credentials_contractor_active ON "Credential" ("contractorId") WHERE "revokedAt" IS NULL;
CREATE INDEX idx_audit_logs_contractor_action ON "AuditLog" ("contractorId", "action");
```

---

## Troubleshooting

### API won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Common issues:
# 1. DATABASE_URL not set correctly
# 2. Prisma client not generated
# 3. Port 3001 already in use
```

### Database connection errors

```bash
# Test connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U contractor_passport

# Reset database (DANGER: deletes all data)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d postgres
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

### High memory usage

```bash
# Check resource usage
docker stats

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Adjust memory limits in docker-compose.yml
```

---

## Production Checklist

### Day 1
- [ ] Deploy to staging environment first
- [ ] Run E2E tests: `cd workspace/tests && ./run-e2e.sh`
- [ ] Verify all endpoints work
- [ ] Check error monitoring (Sentry)
- [ ] Test credential issuance flow
- [ ] Verify rate limiting works

### Week 1
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify backups are running
- [ ] Test disaster recovery
- [ ] Review security logs

### Month 1
- [ ] Review and optimize database queries
- [ ] Analyze API usage patterns
- [ ] Adjust rate limits if needed
- [ ] Update dependencies
- [ ] Security audit

---

## Emergency Procedures

### Database Restore
```bash
# Stop API
docker-compose -f docker-compose.prod.yml stop api

# Restore from backup
gunzip < backup-20250127.sql.gz | docker exec -i contractor-passport-db psql -U contractor_passport contractor_passport

# Start API
docker-compose -f docker-compose.prod.yml start api
```

### Rollback Deployment
```bash
# Find previous version
git log --oneline

# Checkout previous version
git checkout <commit-hash>

# Redeploy
docker-compose -f docker-compose.prod.yml up -d --build
```

### Emergency Shutdown
```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes (DANGER)
docker-compose -f docker-compose.prod.yml down -v
```

---

## Support

- **Documentation**: `/workspace/README.md`
- **API Docs**: `http://your-domain/api/docs` (once Swagger is implemented)
- **Issues**: https://github.com/yourorg/contractor-passport/issues
- **On-call**: Set up PagerDuty or OpsGenie for critical alerts
