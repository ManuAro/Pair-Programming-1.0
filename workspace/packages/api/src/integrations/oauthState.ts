import jwt from 'jsonwebtoken';

// Enforce OAUTH_STATE_SECRET in production
const NODE_ENV = process.env.NODE_ENV || 'development';
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET ||
  (NODE_ENV === 'production'
    ? (() => { throw new Error('OAUTH_STATE_SECRET must be set in production') })()
    : 'dev-oauth-state-secret');
const OAUTH_STATE_ISSUER = process.env.OAUTH_STATE_ISSUER || 'contractor-passport-oauth';

export type OAuthProvider = 'github' | 'linkedin';

export interface OAuthStatePayload {
  contractorId: string;
  verificationId: string;
  provider: OAuthProvider;
  returnTo?: string;
}

export function createOAuthState(payload: OAuthStatePayload): string {
  return jwt.sign(payload, OAUTH_STATE_SECRET, {
    algorithm: 'HS256',
    issuer: OAUTH_STATE_ISSUER,
    expiresIn: '15m',
  });
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  return jwt.verify(state, OAUTH_STATE_SECRET, {
    algorithms: ['HS256'],
    issuer: OAUTH_STATE_ISSUER,
  }) as OAuthStatePayload;
}

export function isUsingDefaultOAuthSecret(): boolean {
  return !process.env.OAUTH_STATE_SECRET;
}
