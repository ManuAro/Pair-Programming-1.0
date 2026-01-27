/**
 * E2E Test Suite for Contractor Passport
 *
 * Tests the complete flow:
 * 1. Onboard contractor
 * 2. Create verifications
 * 3. Mark verifications as verified
 * 4. Issue credentials (PROVISIONAL and FULL_CLEARANCE)
 * 5. Verify credentials
 * 6. Test persistence across server restarts
 * 7. Test revocation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const api: AxiosInstance = axios.create({ baseURL: API_BASE_URL });

interface Contractor {
  id: string;
  name: string;
  email: string;
}

interface Verification {
  id: string;
  type: string;
  status: string;
}

interface Credential {
  id: string;
  tier: string;
  jwtToken: string;
  issuedAt: string;
  expiresAt: string;
}

let testContractor: Contractor;
let provisionalCredential: Credential;
let fullClearanceCredential: Credential;

describe('E2E: Contractor Onboarding Flow', () => {
  beforeAll(async () => {
    // Wait for API to be ready
    let retries = 10;
    while (retries > 0) {
      try {
        await api.get('/health');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw new Error('API not available');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });

  it('should return healthy status', async () => {
    const response = await api.get('/health');
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'ok');
    expect(response.data).toHaveProperty('timestamp');
  });

  it('should onboard a new contractor', async () => {
    const timestamp = Date.now();
    const response = await api.post('/api/contractors/onboard', {
      name: `Test Contractor ${timestamp}`,
      email: `test-${timestamp}@example.com`,
    });

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.contractor).toHaveProperty('id');
    expect(response.data.contractor.name).toContain('Test Contractor');

    testContractor = response.data.contractor;
  });

  it('should reject duplicate email onboarding', async () => {
    try {
      await api.post('/api/contractors/onboard', {
        name: testContractor.name,
        email: testContractor.email,
      });
      fail('Should have thrown 409 error');
    } catch (error: any) {
      expect(error.response.status).toBe(409);
      expect(error.response.data.error).toContain('already exists');
    }
  });

  it('should create identity verification', async () => {
    const response = await api.post(`/api/contractors/${testContractor.id}/verifications`, {
      type: 'identity',
      provider: 'persona',
      data: { ssn_verified: true },
    });

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.verification.type).toBe('identity');
    expect(response.data.verification.status).toBe('pending');
  });

  it('should create linkedin verification', async () => {
    const response = await api.post(`/api/contractors/${testContractor.id}/verifications`, {
      type: 'linkedin',
      provider: 'oauth',
    });

    expect(response.status).toBe(201);
    expect(response.data.verification.type).toBe('linkedin');
  });

  it('should create github verification', async () => {
    const response = await api.post(`/api/contractors/${testContractor.id}/verifications`, {
      type: 'github',
      provider: 'oauth',
    });

    expect(response.status).toBe(201);
    expect(response.data.verification.type).toBe('github');
  });

  it('should fetch contractor with verifications', async () => {
    const response = await api.get(`/api/contractors/${testContractor.id}`);

    expect(response.status).toBe(200);
    expect(response.data.contractor.id).toBe(testContractor.id);
    expect(response.data.contractor.verifications).toHaveLength(3);
  });

  it('should mark verifications as verified', async () => {
    const contractorResponse = await api.get(`/api/contractors/${testContractor.id}`);
    const verifications: Verification[] = contractorResponse.data.contractor.verifications;

    for (const verification of verifications) {
      const response = await api.patch(`/api/verifications/${verification.id}`, {
        status: 'verified',
        data: { verified_at: new Date().toISOString() },
      });

      expect(response.status).toBe(200);
      expect(response.data.verification.status).toBe('verified');
    }
  });

  it('should issue PROVISIONAL credential (3 verifications)', async () => {
    const response = await api.post(`/api/contractors/${testContractor.id}/credentials`);

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.credential.tier).toBe('PROVISIONAL');
    expect(response.data.credential).toHaveProperty('jwtToken');

    provisionalCredential = response.data.credential;
  });

  it('should verify PROVISIONAL credential', async () => {
    const response = await api.get(`/api/credentials/${provisionalCredential.id}/verify`);

    expect(response.status).toBe(200);
    expect(response.data.valid).toBe(true);
    expect(response.data.credential.tier).toBe('PROVISIONAL');
    expect(response.data.verifications).toHaveLength(3);
  });

  it('should return existing credential if already issued', async () => {
    const response = await api.post(`/api/contractors/${testContractor.id}/credentials`);

    expect(response.status).toBe(200);
    expect(response.data.credential.id).toBe(provisionalCredential.id);
    expect(response.data.message).toContain('already has a valid credential');
  });
});

describe('E2E: FULL_CLEARANCE Tier', () => {
  it('should create background_check verification', async () => {
    const response = await api.post(`/api/contractors/${testContractor.id}/verifications`, {
      type: 'background_check',
      provider: 'checkr',
    });

    expect(response.status).toBe(201);
    expect(response.data.verification.type).toBe('background_check');
  });

  it('should create 2 reference verifications', async () => {
    const ref1 = await api.post(`/api/contractors/${testContractor.id}/verifications`, {
      type: 'reference',
      provider: 'email',
      data: { referee_name: 'John Doe', referee_email: 'john@example.com' },
    });

    const ref2 = await api.post(`/api/contractors/${testContractor.id}/verifications`, {
      type: 'reference',
      provider: 'email',
      data: { referee_name: 'Jane Smith', referee_email: 'jane@example.com' },
    });

    expect(ref1.status).toBe(201);
    expect(ref2.status).toBe(201);
  });

  it('should mark new verifications as verified', async () => {
    const contractorResponse = await api.get(`/api/contractors/${testContractor.id}`);
    const verifications: Verification[] = contractorResponse.data.contractor.verifications;

    const pendingVerifications = verifications.filter((v: Verification) => v.status === 'pending');

    for (const verification of pendingVerifications) {
      await api.patch(`/api/verifications/${verification.id}`, {
        status: 'verified',
      });
    }

    // Verify all verifications are now verified
    const updatedContractor = await api.get(`/api/contractors/${testContractor.id}`);
    const allVerified = updatedContractor.data.contractor.verifications.every(
      (v: Verification) => v.status === 'verified'
    );
    expect(allVerified).toBe(true);
  });

  it('should revoke existing PROVISIONAL credential before issuing FULL_CLEARANCE', async () => {
    // First, revoke the existing provisional credential
    const revokeResponse = await api.post(`/api/credentials/${provisionalCredential.id}/revoke`, {
      reason: 'Upgrading to FULL_CLEARANCE',
    });

    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.data.success).toBe(true);

    // Verify the credential is now revoked
    const verifyResponse = await api.get(`/api/credentials/${provisionalCredential.id}/verify`);
    expect(verifyResponse.status).toBe(400);
    expect(verifyResponse.data.valid).toBe(false);
    expect(verifyResponse.data.error).toContain('revoked');
  });

  it('should issue FULL_CLEARANCE credential (5+ verifications)', async () => {
    const response = await api.post(`/api/contractors/${testContractor.id}/credentials`);

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.credential.tier).toBe('FULL_CLEARANCE');

    fullClearanceCredential = response.data.credential;
  });

  it('should verify FULL_CLEARANCE credential', async () => {
    const response = await api.get(`/api/credentials/${fullClearanceCredential.id}/verify`);

    expect(response.status).toBe(200);
    expect(response.data.valid).toBe(true);
    expect(response.data.credential.tier).toBe('FULL_CLEARANCE');
    expect(response.data.verifications.length).toBeGreaterThanOrEqual(5);
  });

  it('should verify FULL_CLEARANCE has 90-day expiry', async () => {
    const issuedAt = new Date(fullClearanceCredential.issuedAt);
    const expiresAt = new Date(fullClearanceCredential.expiresAt);
    const diffDays = (expiresAt.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24);

    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(91);
  });
});

describe('E2E: Key Persistence & Server Restart', () => {
  it('should access JWKS endpoint', async () => {
    const response = await api.get('/.well-known/jwks.json');

    expect(response.status).toBe(200);
    expect(response.data.keys).toHaveLength(1);
    expect(response.data.keys[0]).toHaveProperty('kty', 'RSA');
    expect(response.data.keys[0]).toHaveProperty('kid');
    expect(response.data.keys[0]).toHaveProperty('n');
    expect(response.data.keys[0]).toHaveProperty('e');
  });

  // NOTE: This test would require actually restarting the server
  // In a real CI/CD environment, you would:
  // 1. Stop the server process
  // 2. Restart it
  // 3. Verify the credential still validates
  // 4. Verify the JWKS kid hasn't changed
  it.skip('should validate credential after server restart', async () => {
    // This test is intentionally skipped because it requires external orchestration
    // To test manually:
    // 1. Run this test suite
    // 2. Kill the API server
    // 3. Restart the API server
    // 4. Re-run the verification test
  });
});

describe('E2E: Credential Revocation', () => {
  it('should check credential status', async () => {
    const response = await api.get(`/api/credentials/${fullClearanceCredential.id}/status`);

    expect(response.status).toBe(200);
    expect(response.data.revoked).toBe(false);
    expect(response.data.expired).toBe(false);
    expect(response.data.valid).toBe(true);
  });

  it('should revoke a credential', async () => {
    const response = await api.post(`/api/credentials/${fullClearanceCredential.id}/revoke`, {
      reason: 'Security incident - test revocation',
      actor: 'system:e2e-test',
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data).toHaveProperty('revokedAt');
  });

  it('should fail to verify revoked credential', async () => {
    const response = await api.get(`/api/credentials/${fullClearanceCredential.id}/verify`);

    expect(response.status).toBe(400);
    expect(response.data.valid).toBe(false);
    expect(response.data.error).toContain('revoked');
  });

  it('should show revoked status', async () => {
    const response = await api.get(`/api/credentials/${fullClearanceCredential.id}/status`);

    expect(response.status).toBe(200);
    expect(response.data.revoked).toBe(true);
    expect(response.data.valid).toBe(false);
    expect(response.data).toHaveProperty('revokedAt');
  });
});

describe('E2E: Error Handling', () => {
  it('should return 404 for non-existent contractor', async () => {
    try {
      await api.get('/api/contractors/non-existent-id');
      fail('Should have thrown 404 error');
    } catch (error: any) {
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toContain('not found');
    }
  });

  it('should return 404 for non-existent credential', async () => {
    const response = await api.get('/api/credentials/non-existent-id/verify');
    expect(response.status).toBe(404);
    expect(response.data.valid).toBe(false);
    expect(response.data.error).toContain('not found');
  });

  it('should validate input on onboarding', async () => {
    try {
      await api.post('/api/contractors/onboard', {
        name: 'A', // Too short
        email: 'invalid-email',
      });
      fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toContain('Validation failed');
    }
  });

  it('should reject credential issuance without verifications', async () => {
    const timestamp = Date.now();
    const newContractor = await api.post('/api/contractors/onboard', {
      name: `Unverified ${timestamp}`,
      email: `unverified-${timestamp}@example.com`,
    });

    try {
      await api.post(`/api/contractors/${newContractor.data.contractor.id}/credentials`);
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toContain('Not eligible');
    }
  });
});

console.log('\n✅ E2E Test Suite Complete\n');
