import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { loadOrCreateKeyPair } from './crypto/keys';
import {
  apiLimiter,
  authLimiter,
  credentialIssuanceLimiter,
  verificationLimiter,
  onboardingLimiter
} from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger, requestLogger } from './utils/logger';
import { businessEvents } from './utils/businessEvents';
import { initializeSentry, sentryErrorHandler } from './monitoring/sentry';
import { openApiSpec } from './docs/openapi';
import {
  buildGitHubAuthUrl,
  exchangeGitHubCode,
  fetchGitHubProfile,
} from './integrations/github';
import {
  buildLinkedInAuthUrl,
  exchangeLinkedInCode,
  fetchLinkedInProfile,
} from './integrations/linkedin';
import {
  createOAuthState,
  isUsingDefaultOAuthSecret,
  verifyOAuthState,
} from './integrations/oauthState';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// Initialize Sentry (must be first)
initializeSentry(app);

// JWT Configuration
// In production, use a secure key from env and proper key rotation
const JWT_ISSUER = process.env.JWT_ISSUER || 'contractor-passport';

// RSA key pair for JWKS (loaded from env or persisted on disk)
const { publicKeyPem, privateKeyPem, jwk, kid } = loadOrCreateKeyPair();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for docs
}));

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', // In production, set to specific domain
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json());

// Request logging
app.use(requestLogger);

if (isUsingDefaultOAuthSecret()) {
  logger.warn('OAUTH_STATE_SECRET not set; using default (insecure for production)');
}

// API docs
app.get('/api/openapi.json', (req, res) => {
  res.json(openApiSpec);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Global rate limiting (applies to all routes)
app.use(apiLimiter);

// Validation schemas
const onboardSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

const verificationTypeEnum = z.enum(['identity', 'github', 'linkedin', 'background_check', 'reference']);
const verificationStatusEnum = z.enum(['pending', 'verified', 'failed']);

const createVerificationSchema = z.object({
  type: verificationTypeEnum,
  provider: z.string().optional(),
  data: z.record(z.any()).optional(),
});

const updateVerificationSchema = z.object({
  status: verificationStatusEnum,
  data: z.record(z.any()).optional(),
});

// Helper: Determine tier based on verifications
type VerificationType = 'identity' | 'github' | 'linkedin' | 'background_check' | 'reference';

interface TierRequirement {
  tier: 'PROVISIONAL' | 'FULL_CLEARANCE';
  required: VerificationType[];
  minVerifiedByType?: Partial<Record<VerificationType, number>>;
  expiryDays: number;
}

const TIER_REQUIREMENTS: TierRequirement[] = [
  {
    tier: 'FULL_CLEARANCE',
    required: ['identity', 'github', 'linkedin', 'background_check', 'reference'],
    minVerifiedByType: { reference: 2 },
    expiryDays: 90, // credential validity window
  },
  {
    tier: 'PROVISIONAL',
    required: ['identity'],
    expiryDays: 1, // 24 hours for provisional
  },
];

function determineEligibleTier(verifications: any[]): TierRequirement | null {
  const verified = verifications.filter((v) => v.status === 'verified');
  const verifiedTypes = new Set(verified.map((v) => v.type));
  const verifiedCounts = verified.reduce<Record<string, number>>((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  // Check from highest tier to lowest
  for (const requirement of TIER_REQUIREMENTS) {
    const hasAllRequired = requirement.required.every((type) =>
      verifiedTypes.has(type)
    );
    const meetsCounts = Object.entries(requirement.minVerifiedByType || {}).every(
      ([type, min]) => (verifiedCounts[type] || 0) >= (min || 0)
    );

    if (hasAllRequired && meetsCounts) {
      return requirement;
    }
  }

  return null; // Not eligible for any tier
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function safeReturnTo(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const base = process.env.WEB_BASE_URL;
  if (!base) {
    return undefined;
  }

  try {
    if (raw.startsWith('/')) {
      return new URL(raw, base).toString();
    }
    const target = new URL(raw);
    const allowed = new URL(base);
    return target.origin === allowed.origin ? target.toString() : undefined;
  } catch {
    return undefined;
  }
}

const githubScopes = (process.env.GITHUB_SCOPES || 'read:user user:email').split(' ').filter(Boolean);
const linkedinScopes = (process.env.LINKEDIN_SCOPES || 'openid profile email').split(' ').filter(Boolean);

// Helper: Create JWT credential
function createCredentialJWT(
  contractorId: string,
  tier: string,
  expiresAt: Date,
  verifications: any[]
): string {
  const payload = {
    sub: contractorId,
    iss: JWT_ISSUER,
    tier,
    verifications: verifications.map((v) => ({
      type: v.type,
      status: v.status,
      provider: v.provider,
      completedAt: v.completedAt,
    })),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  return jwt.sign(payload, privateKeyPem, { algorithm: 'RS256', keyid: kid });
}

// Helper: Verify JWT credential
function verifyCredentialJWT(token: string): any {
  try {
    return jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] });
  } catch (error) {
    throw new Error('Invalid or expired credential');
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Onboarding endpoint
app.post('/api/contractors/onboard', onboardingLimiter, async (req, res) => {
  try {
    // Validate input
    const validated = onboardSchema.parse(req.body);

    // Check if contractor already exists
    const existing = await prisma.contractor.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Contractor with this email already exists',
        contractorId: existing.id,
      });
    }

    // Create contractor
    const contractor = await prisma.contractor.create({
      data: {
        name: validated.name,
        email: validated.email,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        contractorId: contractor.id,
        action: 'contractor_onboarded',
        actor: 'system',
        metadata: JSON.stringify({ source: 'web', timestamp: new Date().toISOString() }),
      },
    });

    // Log business event
    businessEvents.onboardingCompleted({
      contractorId: contractor.id,
      email: contractor.email,
      source: 'web',
    });

    res.status(201).json({
      success: true,
      contractor: {
        id: contractor.id,
        name: contractor.name,
        email: contractor.email,
        createdAt: contractor.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GitHub OAuth start
app.get('/api/oauth/github/start', authLimiter, async (req, res) => {
  try {
    const contractorId = req.query.contractorId;
    const returnTo = safeReturnTo(req.query.returnTo as string | undefined);

    if (typeof contractorId !== 'string') {
      return res.status(400).json({ error: 'contractorId is required' });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
    });

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    const verification = await prisma.verification.create({
      data: {
        contractorId,
        type: 'github',
        status: 'pending',
        provider: 'github',
        data: '{}',
      },
    });

    const state = createOAuthState({
      contractorId,
      verificationId: verification.id,
      provider: 'github',
      returnTo,
    });

    const authUrl = buildGitHubAuthUrl({
      clientId: getEnvOrThrow('GITHUB_CLIENT_ID'),
      redirectUri: getEnvOrThrow('GITHUB_CALLBACK_URL'),
      state,
      scopes: githubScopes,
    });

    await prisma.auditLog.create({
      data: {
        contractorId,
        action: 'oauth_github_started',
        actor: 'system',
        metadata: JSON.stringify({
          verificationId: verification.id,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    res.json({ url: authUrl, verificationId: verification.id });
  } catch (error: any) {
    logger.error({ err: error }, 'GitHub OAuth start error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GitHub OAuth callback
app.get('/api/oauth/github/callback', authLimiter, async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  // Handle OAuth provider errors (user cancellation, access denied, etc)
  if (error) {
    logger.warn({ error, errorDescription }, 'GitHub OAuth error from provider');

    // Try to decode state to mark verification as failed
    if (typeof state === 'string') {
      try {
        const payload = verifyOAuthState(state);
        await prisma.verification.update({
          where: { id: payload.verificationId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            data: JSON.stringify({
              error: error as string,
              errorDescription: errorDescription as string || 'OAuth authorization failed',
            }),
          },
        });

        await prisma.auditLog.create({
          data: {
            contractorId: payload.contractorId,
            action: 'oauth_github_failed',
            actor: 'system',
            metadata: JSON.stringify({
              verificationId: payload.verificationId,
              error: error as string,
              errorDescription: errorDescription as string,
              timestamp: new Date().toISOString(),
            }),
          },
        });

        if (payload.returnTo) {
          const redirectUrl = new URL(payload.returnTo);
          redirectUrl.searchParams.set('status', 'failed');
          redirectUrl.searchParams.set('error', error as string);
          redirectUrl.searchParams.set('verificationId', payload.verificationId);
          return res.redirect(redirectUrl.toString());
        }
      } catch (stateError) {
        logger.error({ err: stateError }, 'Failed to process state for OAuth error');
      }
    }

    return res.status(400).json({
      error: error as string,
      description: errorDescription as string || 'OAuth authorization failed',
    });
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'code and state are required' });
  }

  let payload;
  try {
    payload = verifyOAuthState(state);
  } catch (error: any) {
    logger.warn({ err: error }, 'Invalid OAuth state');
    return res.status(400).json({ error: 'Invalid state' });
  }

  if (payload.provider !== 'github') {
    return res.status(400).json({ error: 'Invalid state provider' });
  }

  try {
    const verification = await prisma.verification.findUnique({
      where: { id: payload.verificationId },
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    // Security: Validate verification is still pending (prevent replay attacks)
    if (verification.status !== 'pending') {
      logger.warn(
        { verificationId: verification.id, status: verification.status },
        'Attempted to use non-pending verification'
      );
      return res.status(400).json({
        error: 'Verification already completed or invalid',
        status: verification.status,
      });
    }

    // Security: Validate contractorId matches between state and verification
    if (verification.contractorId !== payload.contractorId) {
      logger.error(
        {
          verificationId: verification.id,
          expectedContractorId: verification.contractorId,
          receivedContractorId: payload.contractorId,
        },
        'ContractorId mismatch in GitHub OAuth callback'
      );
      return res.status(400).json({ error: 'Invalid verification state' });
    }

    const token = await exchangeGitHubCode(
      {
        clientId: getEnvOrThrow('GITHUB_CLIENT_ID'),
        clientSecret: getEnvOrThrow('GITHUB_CLIENT_SECRET'),
        redirectUri: getEnvOrThrow('GITHUB_CALLBACK_URL'),
        scopes: githubScopes,
      },
      code
    );

    const profile = await fetchGitHubProfile(token.access_token);
    const primaryEmail = profile.emails.find((email) => email.primary && email.verified)?.email
      || profile.emails.find((email) => email.verified)?.email
      || null;

    // Security: Require verified email for GitHub verification
    if (!primaryEmail) {
      logger.warn(
        { verificationId: verification.id, githubId: profile.user.id },
        'GitHub verification failed: no verified email found'
      );

      await prisma.verification.update({
        where: { id: verification.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          data: JSON.stringify({
            error: 'no_verified_email',
            message: 'GitHub account must have a verified email address',
            user: profile.user,
          }),
        },
      });

      await prisma.auditLog.create({
        data: {
          contractorId: verification.contractorId,
          action: 'oauth_github_failed',
          actor: 'system',
          metadata: JSON.stringify({
            verificationId: verification.id,
            reason: 'no_verified_email',
            timestamp: new Date().toISOString(),
          }),
        },
      });

      if (payload.returnTo) {
        const redirectUrl = new URL(payload.returnTo);
        redirectUrl.searchParams.set('status', 'failed');
        redirectUrl.searchParams.set('error', 'no_verified_email');
        redirectUrl.searchParams.set('verificationId', verification.id);
        return res.redirect(redirectUrl.toString());
      }

      return res.status(400).json({
        error: 'GitHub verification failed',
        message: 'Your GitHub account must have a verified email address. Please add and verify an email in your GitHub settings.',
      });
    }

    const updated = await prisma.verification.update({
      where: { id: verification.id },
      data: {
        status: 'verified',
        completedAt: new Date(),
        data: JSON.stringify({
          user: profile.user,
          email: primaryEmail,
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        contractorId: verification.contractorId,
        action: 'oauth_github_verified',
        actor: 'system',
        metadata: JSON.stringify({
          verificationId: verification.id,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    if (payload.returnTo) {
      const redirectUrl = new URL(payload.returnTo);
      redirectUrl.searchParams.set('status', updated.status);
      redirectUrl.searchParams.set('verificationId', updated.id);
      redirectUrl.searchParams.set('provider', 'github');
      return res.redirect(redirectUrl.toString());
    }

    res.json({
      success: true,
      verificationId: updated.id,
      provider: 'github',
      profile: {
        id: profile.user.id,
        login: profile.user.login,
        htmlUrl: profile.user.html_url,
        email: primaryEmail,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'GitHub OAuth callback error');
    try {
      await prisma.verification.update({
        where: { id: payload.verificationId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          data: JSON.stringify({ error: 'github_oauth_failed' }),
        },
      });
    } catch (updateError: any) {
      logger.error({ err: updateError }, 'Failed to update GitHub verification status');
    }
    res.status(500).json({ error: 'GitHub OAuth failed' });
  }
});

// LinkedIn OAuth start
app.get('/api/oauth/linkedin/start', authLimiter, async (req, res) => {
  try {
    const contractorId = req.query.contractorId;
    const returnTo = safeReturnTo(req.query.returnTo as string | undefined);

    if (typeof contractorId !== 'string') {
      return res.status(400).json({ error: 'contractorId is required' });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
    });

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    const verification = await prisma.verification.create({
      data: {
        contractorId,
        type: 'linkedin',
        status: 'pending',
        provider: 'linkedin',
        data: '{}',
      },
    });

    const state = createOAuthState({
      contractorId,
      verificationId: verification.id,
      provider: 'linkedin',
      returnTo,
    });

    const authUrl = buildLinkedInAuthUrl({
      clientId: getEnvOrThrow('LINKEDIN_CLIENT_ID'),
      redirectUri: getEnvOrThrow('LINKEDIN_CALLBACK_URL'),
      state,
      scopes: linkedinScopes,
    });

    await prisma.auditLog.create({
      data: {
        contractorId,
        action: 'oauth_linkedin_started',
        actor: 'system',
        metadata: JSON.stringify({
          verificationId: verification.id,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    res.json({ url: authUrl, verificationId: verification.id });
  } catch (error: any) {
    logger.error({ err: error }, 'LinkedIn OAuth start error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LinkedIn OAuth callback
app.get('/api/oauth/linkedin/callback', authLimiter, async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  // Handle OAuth provider errors (user cancellation, access denied, etc)
  if (error) {
    logger.warn({ error, errorDescription }, 'LinkedIn OAuth error from provider');

    // Try to decode state to mark verification as failed
    if (typeof state === 'string') {
      try {
        const payload = verifyOAuthState(state);
        await prisma.verification.update({
          where: { id: payload.verificationId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            data: JSON.stringify({
              error: error as string,
              errorDescription: errorDescription as string || 'OAuth authorization failed',
            }),
          },
        });

        await prisma.auditLog.create({
          data: {
            contractorId: payload.contractorId,
            action: 'oauth_linkedin_failed',
            actor: 'system',
            metadata: JSON.stringify({
              verificationId: payload.verificationId,
              error: error as string,
              errorDescription: errorDescription as string,
              timestamp: new Date().toISOString(),
            }),
          },
        });

        if (payload.returnTo) {
          const redirectUrl = new URL(payload.returnTo);
          redirectUrl.searchParams.set('status', 'failed');
          redirectUrl.searchParams.set('error', error as string);
          redirectUrl.searchParams.set('verificationId', payload.verificationId);
          return res.redirect(redirectUrl.toString());
        }
      } catch (stateError) {
        logger.error({ err: stateError }, 'Failed to process state for OAuth error');
      }
    }

    return res.status(400).json({
      error: error as string,
      description: errorDescription as string || 'OAuth authorization failed',
    });
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'code and state are required' });
  }

  let payload;
  try {
    payload = verifyOAuthState(state);
  } catch (error: any) {
    logger.warn({ err: error }, 'Invalid OAuth state');
    return res.status(400).json({ error: 'Invalid state' });
  }

  if (payload.provider !== 'linkedin') {
    return res.status(400).json({ error: 'Invalid state provider' });
  }

  try {
    const verification = await prisma.verification.findUnique({
      where: { id: payload.verificationId },
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    // Security: Validate verification is still pending (prevent replay attacks)
    if (verification.status !== 'pending') {
      logger.warn(
        { verificationId: verification.id, status: verification.status },
        'Attempted to use non-pending verification'
      );
      return res.status(400).json({
        error: 'Verification already completed or invalid',
        status: verification.status,
      });
    }

    // Security: Validate contractorId matches between state and verification
    if (verification.contractorId !== payload.contractorId) {
      logger.error(
        {
          verificationId: verification.id,
          expectedContractorId: verification.contractorId,
          receivedContractorId: payload.contractorId,
        },
        'ContractorId mismatch in LinkedIn OAuth callback'
      );
      return res.status(400).json({ error: 'Invalid verification state' });
    }

    const token = await exchangeLinkedInCode(
      {
        clientId: getEnvOrThrow('LINKEDIN_CLIENT_ID'),
        clientSecret: getEnvOrThrow('LINKEDIN_CLIENT_SECRET'),
        redirectUri: getEnvOrThrow('LINKEDIN_CALLBACK_URL'),
        scopes: linkedinScopes,
      },
      code
    );

    const profile = await fetchLinkedInProfile(token.access_token);

    const updated = await prisma.verification.update({
      where: { id: verification.id },
      data: {
        status: 'verified',
        completedAt: new Date(),
        data: JSON.stringify({ profile }),
      },
    });

    await prisma.auditLog.create({
      data: {
        contractorId: verification.contractorId,
        action: 'oauth_linkedin_verified',
        actor: 'system',
        metadata: JSON.stringify({
          verificationId: verification.id,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    if (payload.returnTo) {
      const redirectUrl = new URL(payload.returnTo);
      redirectUrl.searchParams.set('status', updated.status);
      redirectUrl.searchParams.set('verificationId', updated.id);
      redirectUrl.searchParams.set('provider', 'linkedin');
      return res.redirect(redirectUrl.toString());
    }

    res.json({
      success: true,
      verificationId: updated.id,
      provider: 'linkedin',
      profile,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'LinkedIn OAuth callback error');
    try {
      await prisma.verification.update({
        where: { id: payload.verificationId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          data: JSON.stringify({ error: 'linkedin_oauth_failed' }),
        },
      });
    } catch (updateError: any) {
      logger.error({ err: updateError }, 'Failed to update LinkedIn verification status');
    }
    res.status(500).json({ error: 'LinkedIn OAuth failed' });
  }
});

// Get contractor by ID
app.get('/api/contractors/:id', async (req, res) => {
  try {
    const contractor = await prisma.contractor.findUnique({
      where: { id: req.params.id },
      include: {
        verifications: true,
        credentials: true,
      },
    });

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    res.json({ contractor });
  } catch (error) {
    console.error('Get contractor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create verification for contractor
app.post('/api/contractors/:id/verifications', verificationLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate contractor exists
    const contractor = await prisma.contractor.findUnique({
      where: { id },
    });

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Validate input
    const validated = createVerificationSchema.parse(req.body);

    // Create verification
    const verification = await prisma.verification.create({
      data: {
        contractorId: id,
        type: validated.type,
        status: 'pending',
        provider: validated.provider || 'manual',
        data: validated.data ? JSON.stringify(validated.data) : '{}',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        contractorId: id,
        action: 'verification_created',
        actor: 'system',
        metadata: JSON.stringify({
          verificationType: validated.type,
          verificationId: verification.id,
          timestamp: new Date().toISOString()
        }),
      },
    });

    res.status(201).json({
      success: true,
      verification: {
        id: verification.id,
        type: verification.type,
        status: verification.status,
        provider: verification.provider,
        createdAt: verification.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Create verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update verification status
app.patch('/api/verifications/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate verification exists
    const existing = await prisma.verification.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    // Validate input
    const validated = updateVerificationSchema.parse(req.body);

    // Update verification
    const updateData: any = {
      status: validated.status,
      data: validated.data ? JSON.stringify(validated.data) : existing.data,
    };

    // Set completedAt if status is verified or failed
    if (validated.status === 'verified' || validated.status === 'failed') {
      updateData.completedAt = new Date();
    }

    const verification = await prisma.verification.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        contractorId: existing.contractorId,
        action: 'verification_updated',
        actor: 'system',
        metadata: JSON.stringify({
          verificationId: id,
          oldStatus: existing.status,
          newStatus: validated.status,
          timestamp: new Date().toISOString()
        }),
      },
    });

    res.json({
      success: true,
      verification: {
        id: verification.id,
        type: verification.type,
        status: verification.status,
        provider: verification.provider,
        completedAt: verification.completedAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Update verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Issue credential for contractor
app.post('/api/contractors/:id/credentials', credentialIssuanceLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    // Get contractor with all verifications
    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: {
        verifications: true,
        credentials: {
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Check if already has valid credential
    if (contractor.credentials.length > 0) {
      const existing = contractor.credentials[0];
      return res.status(200).json({
        success: true,
        credential: {
          id: existing.id,
          tier: existing.tier,
          issuedAt: existing.issuedAt,
          expiresAt: existing.expiresAt,
          jwtToken: existing.jwtToken,
        },
        message: 'Contractor already has a valid credential',
      });
    }

    // Determine eligible tier
    const tierRequirement = determineEligibleTier(contractor.verifications);

    if (!tierRequirement) {
      return res.status(400).json({
        error: 'Not eligible for credential',
        message: 'Complete required verifications first',
        requirements: TIER_REQUIREMENTS.map((r) => ({
          tier: r.tier,
          required: r.required,
        })),
        currentVerifications: contractor.verifications.map((v) => ({
          type: v.type,
          status: v.status,
        })),
      });
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + tierRequirement.expiryDays);

    // Create JWT
    const jwtToken = createCredentialJWT(
      id,
      tierRequirement.tier,
      expiresAt,
      contractor.verifications.filter((v) => v.status === 'verified')
    );

    // Save credential to DB
    const credential = await prisma.credential.create({
      data: {
        contractorId: id,
        tier: tierRequirement.tier,
        jwtToken,
        expiresAt,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        contractorId: id,
        action: 'credential_issued',
        actor: 'system',
        metadata: JSON.stringify({
          credentialId: credential.id,
          tier: tierRequirement.tier,
          expiresAt: expiresAt.toISOString(),
          verificationsUsed: contractor.verifications
            .filter((v) => v.status === 'verified')
            .map((v) => v.type),
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // Log business event
    businessEvents.credentialIssued({
      contractorId: id,
      credentialId: credential.id,
      tier: tierRequirement.tier,
      expiresAt,
      verificationsCount: contractor.verifications.filter((v) => v.status === 'verified').length,
    });

    res.status(201).json({
      success: true,
      credential: {
        id: credential.id,
        tier: credential.tier,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
        jwtToken: credential.jwtToken,
      },
    });
  } catch (error: any) {
    console.error('Issue credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify credential (public endpoint)
app.get('/api/credentials/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;

    // Get credential from DB
    const credential = await prisma.credential.findUnique({
      where: { id },
      include: {
        contractor: {
          include: {
            verifications: {
              where: { status: 'verified' },
            },
          },
        },
      },
    });

    if (!credential) {
      return res.status(404).json({
        valid: false,
        error: 'Credential not found',
      });
    }

    // Check if revoked
    if (credential.revokedAt) {
      return res.status(400).json({
        valid: false,
        error: 'Credential has been revoked',
        revokedAt: credential.revokedAt,
      });
    }

    // Check if expired
    if (new Date() > credential.expiresAt) {
      return res.status(400).json({
        valid: false,
        error: 'Credential has expired',
        expiresAt: credential.expiresAt,
      });
    }

    // Verify JWT signature
    try {
      const payload = verifyCredentialJWT(credential.jwtToken);

      res.json({
        valid: true,
        credential: {
          id: credential.id,
          contractorId: credential.contractorId,
          contractorName: credential.contractor.name,
          tier: credential.tier,
          issuedAt: credential.issuedAt,
          expiresAt: credential.expiresAt,
        },
        verifications: credential.contractor.verifications.map((v) => ({
          type: v.type,
          status: v.status,
          provider: v.provider,
          completedAt: v.completedAt,
        })),
        jwt: {
          issuer: payload.iss,
          subject: payload.sub,
          issuedAt: new Date(payload.iat * 1000),
          expiresAt: new Date(payload.exp * 1000),
        },
      });
    } catch (error) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid JWT signature',
      });
    }
  } catch (error: any) {
    console.error('Verify credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// JWKS endpoint for public key
app.get('/.well-known/jwks.json', async (req, res) => {
  try {
    // Extract public key modulus and exponent for JWK format
  // Create JWKS response (JSON Web Key Set)
  const jwks = {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        kid,
        alg: 'RS256',
        n: jwk.n, // Modulus
        e: jwk.e, // Exponent
        },
      ],
    };

    res.json(jwks);
  } catch (error) {
    console.error('JWKS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke credential
app.post('/api/credentials/:id/revoke', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, actor } = req.body;

    // Get credential
    const credential = await prisma.credential.findUnique({
      where: { id },
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    // Check if already revoked
    if (credential.revokedAt) {
      return res.status(400).json({
        error: 'Credential already revoked',
        revokedAt: credential.revokedAt,
      });
    }

    // Revoke credential
    const revokedAt = new Date();
    const updated = await prisma.credential.update({
      where: { id },
      data: { revokedAt },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        contractorId: credential.contractorId,
        action: 'credential_revoked',
        actor: actor || 'system',
        metadata: JSON.stringify({
          credentialId: id,
          reason: reason || 'No reason provided',
          revokedAt: revokedAt.toISOString(),
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // Log business event
    businessEvents.credentialRevoked({
      contractorId: credential.contractorId,
      credentialId: id,
      reason,
      revokedBy: actor || 'system',
    });

    res.json({
      success: true,
      credentialId: id,
      revokedAt: revokedAt,
      message: 'Credential revoked successfully',
    });
  } catch (error: any) {
    console.error('Revoke credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check credential status (for monitoring/admin)
app.get('/api/credentials/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const credential = await prisma.credential.findUnique({
      where: { id },
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const now = new Date();
    const isExpired = now > credential.expiresAt;
    const isRevoked = credential.revokedAt !== null;
    const isValid = !isExpired && !isRevoked;

    res.json({
      credentialId: id,
      tier: credential.tier,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      revokedAt: credential.revokedAt,
      expired: isExpired,
      revoked: isRevoked,
      valid: isValid,
    });
  } catch (error: any) {
    console.error('Check credential status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Sentry error handler (must be before other error handlers)
app.use(sentryErrorHandler());

// General error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  logger.info('Database connections closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  logger.info('Database connections closed');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info(`🚀 API server running on http://localhost:${PORT}`);
  logger.info(`📋 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔐 JWKS endpoint: http://localhost:${PORT}/.well-known/jwks.json`);
  logger.info(`💾 Database: ${process.env.DATABASE_URL || 'SQLite (dev.db)'}`);
  logger.info(`🔒 Security: Helmet + Rate Limiting enabled`);
  logger.info(`📊 Monitoring: ${process.env.SENTRY_DSN ? 'Sentry enabled' : 'Sentry disabled'}`);
});
