import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Configuration
 *
 * Prevents abuse and DOS attacks by limiting requests per IP address.
 * Different limits for different endpoint types.
 *
 * Environment variables:
 * - DISABLE_RATE_LIMITING=true: Disable all rate limiting (testing only)
 * - RATE_LIMIT_ONBOARDING: Max onboarding requests per hour (default: 10)
 * - RATE_LIMIT_CREDENTIAL: Max credential issuance per hour (default: 10)
 * - RATE_LIMIT_VERIFICATION: Max verification requests per hour (default: 20)
 * - RATE_LIMIT_AUTH: Max auth attempts per 15min (default: 5)
 * - RATE_LIMIT_API: Max general API requests per 15min (default: 100)
 */

const isTestMode = process.env.DISABLE_RATE_LIMITING === 'true';

// Helper to parse env var with default
const getLimit = (envVar: string, defaultValue: number): number => {
  if (isTestMode) return 10000;
  const parsed = parseInt(process.env[envVar] || '', 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// General API rate limit - configurable, default 100 per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getLimit('RATE_LIMIT_API', 100),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limit for auth endpoints - configurable, default 5 per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: getLimit('RATE_LIMIT_AUTH', 5),
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Credential issuance rate limit - configurable, default 10 per hour
export const credentialIssuanceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getLimit('RATE_LIMIT_CREDENTIAL', 10),
  message: {
    error: 'Too many credential issuance requests, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verification creation rate limit - configurable, default 20 per hour
export const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: getLimit('RATE_LIMIT_VERIFICATION', 20),
  message: {
    error: 'Too many verification requests, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Onboarding rate limit - configurable, default 10 per hour (changed from 3)
// Rationale: Small teams onboarding 5 contractors shouldn't hit limits
export const onboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: getLimit('RATE_LIMIT_ONBOARDING', 10),
  message: {
    error: 'Too many onboarding attempts, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
