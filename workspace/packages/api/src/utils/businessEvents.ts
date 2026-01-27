import { logger } from './logger';

/**
 * Business Event Logging
 *
 * Structured logs for key business events to track product metrics.
 * These logs can be exported to analytics systems for dashboards.
 *
 * Events tracked:
 * - onboarding_completed: New contractor successfully onboarded
 * - credential_issued: Credential issued to contractor
 * - credential_revoked: Credential revoked
 * - verification_completed: Verification passed or failed
 */

interface OnboardingEvent {
  contractorId: string;
  email: string;
  source?: string;
}

interface CredentialIssuedEvent {
  contractorId: string;
  credentialId: string;
  tier: string;
  expiresAt: Date;
  verificationsCount: number;
}

interface CredentialRevokedEvent {
  contractorId: string;
  credentialId: string;
  reason?: string;
  revokedBy: string;
}

interface VerificationCompletedEvent {
  contractorId: string;
  verificationId: string;
  type: string;
  status: 'verified' | 'failed';
  provider?: string;
}

export const businessEvents = {
  onboardingCompleted: (data: OnboardingEvent) => {
    logger.info({
      event: 'onboarding_completed',
      contractorId: data.contractorId,
      email: data.email,
      source: data.source || 'web',
      timestamp: new Date().toISOString(),
    });
  },

  credentialIssued: (data: CredentialIssuedEvent) => {
    logger.info({
      event: 'credential_issued',
      contractorId: data.contractorId,
      credentialId: data.credentialId,
      tier: data.tier,
      expiresAt: data.expiresAt.toISOString(),
      verificationsCount: data.verificationsCount,
      timestamp: new Date().toISOString(),
    });
  },

  credentialRevoked: (data: CredentialRevokedEvent) => {
    logger.info({
      event: 'credential_revoked',
      contractorId: data.contractorId,
      credentialId: data.credentialId,
      reason: data.reason,
      revokedBy: data.revokedBy,
      timestamp: new Date().toISOString(),
    });
  },

  verificationCompleted: (data: VerificationCompletedEvent) => {
    logger.info({
      event: 'verification_completed',
      contractorId: data.contractorId,
      verificationId: data.verificationId,
      type: data.type,
      status: data.status,
      provider: data.provider,
      timestamp: new Date().toISOString(),
    });
  },
};
