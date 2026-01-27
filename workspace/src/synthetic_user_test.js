/*
Synthetic user test for contractor flow.
Run with: node workspace/src/synthetic_user_test.js
Requires API running at BASE_URL (default http://localhost:3001)
*/

const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const CONTRACTOR_COUNT = Number(process.env.CONTRACTOR_COUNT || 10);
const OUTPUT_PATH = process.env.OUTPUT_PATH || 'workspace/src/synthetic_user_report.json';

const PROBABILITIES = {
  identity: 0.9,
  github: 0.8,
  linkedin: 0.6,
  background_check: 0.7,
  reference: 0.5,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = data;
    throw error;
  }

  return data;
}

function randomBool(probability) {
  return Math.random() < probability;
}

function syntheticEmail(index) {
  return `synthetic_${index}_${Date.now()}@example.com`;
}

async function createContractor(index) {
  const name = `Synthetic User ${index + 1}`;
  const email = syntheticEmail(index + 1);
  const data = await request('/api/contractors/onboard', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
  return data.contractor;
}

async function createVerification(contractorId, type) {
  const data = await request(`/api/contractors/${contractorId}/verifications`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
  return data.verification;
}

async function updateVerification(verificationId, status, data = {}) {
  return request(`/api/verifications/${verificationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, data }),
  });
}

async function issueCredential(contractorId) {
  return request(`/api/contractors/${contractorId}/credentials`, {
    method: 'POST',
  });
}

async function verifyCredential(credentialId) {
  return request(`/api/credentials/${credentialId}/verify`, {
    method: 'GET',
  });
}

async function runSyntheticUser(index, report) {
  const contractor = await createContractor(index);
  report.steps.onboarded += 1;

  const verificationTypes = ['identity', 'github', 'linkedin', 'background_check'];
  const verificationResults = {};

  for (const type of verificationTypes) {
    const verification = await createVerification(contractor.id, type);
    const passes = randomBool(PROBABILITIES[type]);
    await updateVerification(verification.id, passes ? 'verified' : 'failed', {
      synthetic: true,
      reason: passes ? 'synthetic_pass' : 'synthetic_fail',
    });
    verificationResults[type] = passes;
    report.steps[`verified_${type}`] += passes ? 1 : 0;
    report.steps[`failed_${type}`] += passes ? 0 : 1;
  }

  // Two references required for FULL_CLEARANCE
  const referenceResults = [];
  for (let i = 0; i < 2; i += 1) {
    const verification = await createVerification(contractor.id, 'reference');
    const passes = randomBool(PROBABILITIES.reference);
    await updateVerification(verification.id, passes ? 'verified' : 'failed', {
      synthetic: true,
      referenceIndex: i + 1,
      reason: passes ? 'synthetic_pass' : 'synthetic_fail',
    });
    referenceResults.push(passes);
    report.steps.verified_reference += passes ? 1 : 0;
    report.steps.failed_reference += passes ? 0 : 1;
  }

  const credentialResult = {
    issued: false,
    tier: null,
    credentialId: null,
    verifyOk: false,
    error: null,
  };

  try {
    const issued = await issueCredential(contractor.id);
    if (issued && issued.credential) {
      credentialResult.issued = true;
      credentialResult.tier = issued.credential.tier;
      credentialResult.credentialId = issued.credential.id;
      report.steps.credentials_issued += 1;

      try {
        const verification = await verifyCredential(issued.credential.id);
        credentialResult.verifyOk = Boolean(verification && verification.valid);
        if (credentialResult.verifyOk) {
          report.steps.credentials_verified += 1;
        }
      } catch (err) {
        credentialResult.verifyOk = false;
      }
    }
  } catch (err) {
    credentialResult.error = err.body || { message: err.message };
    report.steps.credentials_failed += 1;
  }

  return {
    contractorId: contractor.id,
    verificationResults,
    referenceResults,
    credentialResult,
  };
}

function buildReport() {
  return {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    contractorsRequested: CONTRACTOR_COUNT,
    steps: {
      onboarded: 0,
      verified_identity: 0,
      failed_identity: 0,
      verified_github: 0,
      failed_github: 0,
      verified_linkedin: 0,
      failed_linkedin: 0,
      verified_background_check: 0,
      failed_background_check: 0,
      verified_reference: 0,
      failed_reference: 0,
      credentials_issued: 0,
      credentials_failed: 0,
      credentials_verified: 0,
    },
    contractors: [],
    summary: {
      provisionalRate: 0,
      fullClearanceRate: 0,
      credentialIssueRate: 0,
    },
  };
}

function computeSummary(report) {
  const total = report.contractors.length || 1;
  const issued = report.steps.credentials_issued;
  const fullClearance = report.contractors.filter((c) => c.credentialResult && c.credentialResult.tier === 'FULL_CLEARANCE').length;
  const provisional = report.contractors.filter((c) => c.credentialResult && c.credentialResult.tier === 'PROVISIONAL').length;

  report.summary.credentialIssueRate = Number((issued / total).toFixed(2));
  report.summary.fullClearanceRate = Number((fullClearance / total).toFixed(2));
  report.summary.provisionalRate = Number((provisional / total).toFixed(2));
}

async function main() {
  const report = buildReport();

  for (let i = 0; i < CONTRACTOR_COUNT; i += 1) {
    try {
      const result = await runSyntheticUser(i, report);
      report.contractors.push(result);
      // Small delay to avoid rate limiting bursts
      await sleep(100);
    } catch (err) {
      report.contractors.push({
        error: err.body || { message: err.message },
      });
    }
  }

  computeSummary(report);
  report.completedAt = new Date().toISOString();

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

  console.log('Synthetic user test completed.');
  console.log(`Report written to ${OUTPUT_PATH}`);
  console.log('Summary:', report.summary);
}

main().catch((err) => {
  console.error('Synthetic user test failed:', err);
  process.exit(1);
});
