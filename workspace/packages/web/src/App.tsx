import { useState, useEffect, FormEvent } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const REQUIRED_VERIFICATIONS = [
  { type: 'identity', label: 'Identity Check', description: 'Government ID + selfie match', tier: 'provisional' },
  { type: 'linkedin', label: 'LinkedIn Verification', description: 'Employment and skills signals', tier: 'provisional' },
  { type: 'github', label: 'GitHub Verification', description: 'Activity and code provenance', tier: 'provisional' },
  { type: 'background_check', label: 'Background Check', description: 'Criminal records and employment history', tier: 'full' },
  { type: 'references', label: 'References (2 required)', description: 'Verified professional references', tier: 'full' },
] as const;

type VerificationType = typeof REQUIRED_VERIFICATIONS[number]['type'];

function App() {
  const [apiStatus, setApiStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [apiData, setApiData] = useState<any>(null);
  const [publicVerifyId, setPublicVerifyId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractor, setContractor] = useState<any>(null);
  const [contractorDetails, setContractorDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [credential, setCredential] = useState<any>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [isIssuingCredential, setIsIssuingCredential] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/verify\/(.+)$/);
    if (match) {
      setPublicVerifyId(match[1]);
    }

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const verificationStatus = urlParams.get('status');
    const oauthProvider = urlParams.get('provider');

    if (verificationStatus && oauthProvider) {
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);

      if (verificationStatus === 'verified') {
        // Show success message
        setError(null);
      } else if (verificationStatus === 'failed') {
        setError(`${oauthProvider} verification failed. Please try again.`);
      }

      // Restore contractor from sessionStorage and load details
      const contractorId = sessionStorage.getItem('contractorId');
      if (contractorId) {
        // Fetch contractor details
        fetch(`${API_BASE}/api/contractors/${contractorId}`)
          .then(res => res.json())
          .then(data => {
            if (data.contractor) {
              setContractor(data.contractor);
              setContractorDetails(data.contractor);
            }
          })
          .catch(err => {
            console.error('Failed to restore contractor:', err);
          });
      }
    }

    fetch(`${API_BASE}/health`)
      .then(res => res.json())
      .then(data => {
        setApiStatus('connected');
        setApiData(data);
      })
      .catch(() => setApiStatus('error'));
  }, []);

  useEffect(() => {
    if (!publicVerifyId) return;

    const fetchVerification = async () => {
      setVerificationLoading(true);
      setVerificationError(null);

      try {
        const response = await fetch(`${API_BASE}/api/credentials/${publicVerifyId}/verify`);
        const data = await response.json();

        if (!response.ok) {
          if (data?.valid === false) {
            setVerificationResult(data);
            return;
          }
          throw new Error(data.error || 'Verification failed');
        }

        setVerificationResult(data);
      } catch (err: any) {
        setVerificationError(err.message);
      } finally {
        setVerificationLoading(false);
      }
    };

    fetchVerification();
  }, [publicVerifyId]);

  useEffect(() => {
    if (!contractorDetails?.verifications?.length) return;
    if (!contractor?.id) return;
    if (credential || isIssuingCredential) return;

    const hasAnyVerified = contractorDetails.verifications.some((v: any) => v.status === 'verified');
    if (!hasAnyVerified) return;

    const issueCredential = async () => {
      setIsIssuingCredential(true);
      setCredentialError(null);

      try {
        const response = await fetch(`${API_BASE}/api/contractors/${contractor.id}/credentials`, {
          method: 'POST',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to issue credential');
        }

        setCredential(data.credential);
      } catch (err: any) {
        setCredentialError(err.message);
      } finally {
        setIsIssuingCredential(false);
      }
    };

    issueCredential();
  }, [contractorDetails, contractor, credential, isIssuingCredential]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/contractors/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Onboarding failed');
      }

      setContractor(data.contractor);
      setContractorDetails(null);
      setCredential(null);

      // Persist contractor ID for OAuth flow
      sessionStorage.setItem('contractorId', data.contractor.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadContractorDetails = async () => {
    if (!contractor?.id) return;
    setDetailsError(null);
    setIsLoadingDetails(true);

    try {
      const response = await fetch(`${API_BASE}/api/contractors/${contractor.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load contractor details');
      }

      const details = data.contractor;
      const existingTypes = new Set(
        (details.verifications || []).map((v: any) => v.type)
      );
      const missingTypes = REQUIRED_VERIFICATIONS
        .map(v => v.type)
        .filter(type => !existingTypes.has(type));

      if (missingTypes.length > 0) {
        for (const type of missingTypes) {
          await fetch(`${API_BASE}/api/contractors/${contractor.id}/verifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, provider: 'manual' }),
          });
        }

        const refreshed = await fetch(`${API_BASE}/api/contractors/${contractor.id}`);
        const refreshedData = await refreshed.json();
        if (!refreshed.ok) {
          throw new Error(refreshedData.error || 'Failed to refresh contractor details');
        }
        setContractorDetails(refreshedData.contractor);
      } else {
        setContractorDetails(details);
      }
    } catch (err: any) {
      setDetailsError(err.message);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const simulateVerification = async () => {
    if (!contractorDetails?.verifications?.length) return;
    setIsSimulating(true);
    setDetailsError(null);

    try {
      const pending = contractorDetails.verifications.filter((v: any) => v.status === 'pending');
      for (const verification of pending) {
        await fetch(`${API_BASE}/api/verifications/${verification.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'verified',
            data: { verified_at: new Date().toISOString(), method: 'demo' },
          }),
        });
      }

      await loadContractorDetails();
    } catch (err: any) {
      setDetailsError(err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const issueCredentialManually = async () => {
    if (!contractor?.id) return;
    setIsIssuingCredential(true);
    setCredentialError(null);

    try {
      const response = await fetch(`${API_BASE}/api/contractors/${contractor.id}/credentials`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to issue credential');
      }

      setCredential(data.credential);
    } catch (err: any) {
      setCredentialError(err.message);
    } finally {
      setIsIssuingCredential(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} copied`);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus(`Unable to copy ${label}`);
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const getExpiryStatus = (expiresAt: string) => {
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    if (msLeft <= 0) {
      return { label: 'Expired', status: 'expired', msLeft };
    }

    const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
    if (hoursLeft <= 24) {
      return { label: `Expires in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`, status: 'expiring', msLeft };
    }

    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    return { label: `Valid for ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, status: 'active', msLeft };
  };

  const statusStyles = (status: string) => {
    if (status === 'verified') return 'bg-green-100 text-green-700';
    if (status === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const expiryInfo = credential ? getExpiryStatus(credential.expiresAt) : null;

  if (publicVerifyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Credential Verification</h1>
              <p className="text-gray-600">Public verification portal for employers</p>
            </div>

            {verificationLoading && (
              <div className="text-center text-gray-600">Verifying credential...</div>
            )}

            {verificationError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm font-medium">{verificationError}</p>
              </div>
            )}

            {verificationResult?.valid && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                  <div>
                    <div className="text-sm text-green-700">Status</div>
                    <div className="text-lg font-semibold text-green-900">✅ Valid Credential</div>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    {verificationResult.credential.tier.replace('_', ' ')}
                  </div>
                </div>

                {/* Beta disclaimer for provisional credentials */}
                {verificationResult.credential.tier === 'PROVISIONAL' && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-600 text-lg">⚠️</span>
                      <div>
                        <div className="text-xs font-bold text-yellow-900 mb-1">BETA CREDENTIAL - PROVISIONAL</div>
                        <div className="text-xs text-yellow-800">
                          This credential includes verified digital signals (GitHub/LinkedIn OAuth).
                          Background checks and reference verification are in development (available in 7-10 days).
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Contractor</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {verificationResult.credential.contractorName}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Credential ID</div>
                  <div className="font-mono text-xs text-gray-900 break-all">
                    {verificationResult.credential.id}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Issued</div>
                    <div className="text-sm text-gray-900">
                      {new Date(verificationResult.credential.issuedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Expires</div>
                    <div className="text-sm text-gray-900">
                      {new Date(verificationResult.credential.expiresAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-2">Verified signals</div>
                  <div className="flex flex-wrap gap-2">
                    {verificationResult.verifications.map((v: any) => (
                      <span
                        key={v.type}
                        className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700"
                      >
                        {v.type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {verificationResult && !verificationResult.valid && !verificationError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-red-800 font-semibold">❌ Invalid Credential</div>
                <div className="text-sm text-red-700 mt-1">{verificationResult.error}</div>
              </div>
            )}

            <div className="mt-6 text-center text-xs text-gray-500">
              Powered by Contractor Passport
            </div>
            <div className="mt-2 text-center text-xs text-gray-500">
              <a className="underline hover:text-gray-700" href="/privacy.html">Privacy</a>
              <span className="mx-2">•</span>
              <a className="underline hover:text-gray-700" href="/terms.html">Terms</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Contractor Passport
            </h1>
            <p className="text-gray-600">
              Verify contractors in 24 hours, not 6 weeks
            </p>
          </div>

          {/* API Status */}
          <div className="mb-8 p-4 rounded-lg border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">API Status:</span>
              <div className="flex items-center gap-2">
                {apiStatus === 'loading' && (
                  <>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                    <span className="text-yellow-600">Connecting...</span>
                  </>
                )}
                {apiStatus === 'connected' && (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-green-600">Connected</span>
                  </>
                )}
                {apiStatus === 'error' && (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="text-red-600">Disconnected</span>
                  </>
                )}
              </div>
            </div>
            {apiData && (
              <div className="mt-2 text-sm text-gray-500">
                Last ping: {new Date(apiData.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Onboarding Form or Success */}
          <div className="space-y-6">
            {!contractor ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900">
                  Start Your Verification
                </h2>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm font-medium">{error}</p>
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Jane Developer"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="jane@example.com"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Creating Account...' : 'Begin Verification'}
                  </button>
                </form>

                <div className="text-center text-sm text-gray-500">
                  <p>Step 1 of 3 • Takes about 10 minutes</p>
                </div>
              </>
            ) : contractorDetails ? (
              <>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Verification Dashboard
                  </h2>
                  <p className="text-gray-600 mb-2">
                    Tracking verifications for {contractorDetails.name}
                  </p>

                  {/* Tier Progress Indicator */}
                  <div className="max-w-2xl mx-auto mt-6 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          contractorDetails.verifications?.filter((v: any) => v.status === 'verified' && ['identity', 'linkedin', 'github'].includes(v.type)).length >= 3
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          PROVISIONAL
                        </span>
                        <span className="text-xs text-gray-500">24h validity</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          contractorDetails.verifications?.filter((v: any) => v.status === 'verified').length >= 5
                            ? 'bg-amber-100 text-amber-900 border-2 border-amber-400'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          FULL CLEARANCE
                        </span>
                        <span className="text-xs text-gray-500">90 days validity</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-amber-500 transition-all duration-500"
                          style={{
                            width: `${(contractorDetails.verifications?.filter((v: any) => v.status === 'verified').length / 5) * 100}%`
                          }}
                        />
                      </div>

                      {/* Checkpoint markers */}
                      <div className="absolute top-0 left-0 right-0 flex justify-between items-center h-2">
                        {REQUIRED_VERIFICATIONS.map((req, idx) => {
                          const verification = contractorDetails.verifications?.find((v: any) => v.type === req.type);
                          const isVerified = verification?.status === 'verified';
                          const position = ((idx + 1) / 5) * 100;

                          return (
                            <div
                              key={req.type}
                              className="absolute -translate-x-1/2"
                              style={{ left: `${position}%` }}
                              title={`${req.label}: ${isVerified ? 'Complete' : 'Pending'}`}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                isVerified
                                  ? 'bg-white border-green-600'
                                  : 'bg-gray-200 border-gray-300'
                              }`}>
                                {isVerified && (
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-center text-gray-600">
                      {contractorDetails.verifications?.filter((v: any) => v.status === 'verified').length || 0} of 5 verifications complete
                    </div>
                  </div>

                  {/* Info boxes */}
                  <div className="grid md:grid-cols-2 gap-3 mt-4 text-left">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="font-semibold text-green-900 text-sm mb-1">Provisional Access</div>
                      <div className="text-xs text-green-700">Complete identity + LinkedIn + GitHub for 24-hour provisional credential</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="font-semibold text-amber-900 text-sm mb-1">Full Clearance</div>
                      <div className="text-xs text-amber-700">Add background check + 2 references for 90-day full clearance (7-10 days processing)</div>
                    </div>
                  </div>
                </div>

                {detailsError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm font-medium">{detailsError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Provisional Tier Verifications */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Provisional Tier</span>
                      <span className="text-xs text-gray-400">(3 required for 24h access)</span>
                    </div>
                    <div className="grid gap-3">
                      {REQUIRED_VERIFICATIONS.filter(req => req.tier === 'provisional').map((req) => {
                        const verification = contractorDetails.verifications?.find(
                          (v: any) => v.type === req.type
                        );
                        const status = verification?.status || 'pending';

                        return (
                          <div
                            key={req.type}
                            className="bg-white border-2 border-green-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{req.label}</div>
                                <div className="text-xs text-gray-500">{req.description}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                {status === 'pending' && (req.type === 'github' || req.type === 'linkedin') && (
                                  <button
                                    onClick={() => {
                                      const returnTo = window.location.href;
                                      window.location.href = `${API_BASE}/api/oauth/${req.type}/start?contractorId=${contractor.id}&returnTo=${encodeURIComponent(returnTo)}`;
                                    }}
                                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                  >
                                    Verify with {req.type === 'github' ? 'GitHub' : 'LinkedIn'}
                                  </button>
                                )}
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles(status)}`}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Full Clearance Tier Verifications */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Full Clearance Tier</span>
                      <span className="text-xs text-gray-400">(+2 more for 90-day access)</span>
                    </div>
                    <div className="grid gap-3">
                      {REQUIRED_VERIFICATIONS.filter(req => req.tier === 'full').map((req) => {
                        const verification = contractorDetails.verifications?.find(
                          (v: any) => v.type === req.type
                        );
                        const status = verification?.status || 'pending';

                        return (
                          <div
                            key={req.type}
                            className="bg-white border-2 border-amber-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-gray-900">{req.label}</div>
                                <div className="text-xs text-gray-500">{req.description}</div>
                              </div>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles(status)}`}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-indigo-900">Credential Status</div>
                      <div className="text-xs text-indigo-700">
                        Auto-issued once eligible verifications are complete
                      </div>
                    </div>
                    {credential && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-200 text-indigo-800">
                        {credential.tier.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {credentialError && (
                    <div className="text-xs text-red-700">{credentialError}</div>
                  )}

                  {isIssuingCredential && (
                    <div className="text-xs text-indigo-700">Issuing credential...</div>
                  )}

                  {!credential && !isIssuingCredential && (
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-indigo-800">
                        No active credential yet.
                      </div>
                      <button
                        onClick={issueCredentialManually}
                        className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        Issue now
                      </button>
                    </div>
                  )}

                  {credential && (
                    <>
                      <div className="flex items-center justify-between text-xs text-indigo-900">
                        <span>Status</span>
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                            expiryInfo?.status === 'expired'
                              ? 'bg-red-100 text-red-700'
                              : expiryInfo?.status === 'expiring'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {expiryInfo?.status === 'expired'
                            ? 'Expired'
                            : expiryInfo?.status === 'expiring'
                            ? 'Expiring soon'
                            : 'Active'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-indigo-900">
                        <span>Expiry</span>
                        <span>
                          {expiryInfo?.label}
                        </span>
                      </div>

                      <div className="bg-white border border-indigo-200 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">JWT Credential</div>
                        <div className="font-mono text-[10px] text-gray-900 break-all">
                          {credential.jwtToken}
                        </div>
                        <button
                          onClick={() => copyToClipboard(credential.jwtToken, 'JWT')}
                          className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                        >
                          Copy JWT
                        </button>
                      </div>

                      <div className="bg-white border border-indigo-200 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Public verification link</div>
                        <div className="font-mono text-[10px] text-gray-900 break-all">
                          {window.location.origin}/verify/{credential.id}
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(`${window.location.origin}/verify/${credential.id}`, 'Verification link')
                          }
                          className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                        >
                          Copy link
                        </button>
                      </div>
                    </>
                  )}

                  {copyStatus && (
                    <div className="text-xs text-indigo-700">{copyStatus}</div>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Contractor ID</div>
                  <div className="font-mono text-gray-900 text-xs break-all">{contractorDetails.id}</div>
                </div>

                <button
                  onClick={simulateVerification}
                  disabled={isSimulating}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSimulating ? 'Simulating Verification...' : 'Simulate All Verified (Demo)'}
                </button>

                <button
                  onClick={() => setContractorDetails(null)}
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Back to Summary
                </button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Account Created!
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Welcome, {contractor.name}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Contractor ID:</span>
                    <span className="font-mono text-gray-900 text-xs">{contractor.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Email:</span>
                    <span className="text-gray-900">{contractor.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Created:</span>
                    <span className="text-gray-900">{new Date(contractor.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm mb-3">
                    <strong>Next steps:</strong>
                  </p>
                  <div className="mb-3 text-[11px] text-blue-900 bg-blue-100/60 border border-blue-200 rounded-md px-2 py-1">
                    <strong>BETA:</strong> GitHub/LinkedIn verifications are live. Background checks and references are
                    coming soon. Provisional credentials are valid for 24h.
                  </div>
                  <div className="space-y-2 text-xs text-blue-900">
                    <div className="flex items-start gap-2">
                      <span className="font-bold">→</span>
                      <span><strong>Provisional (24h):</strong> Complete Identity + LinkedIn + GitHub verification</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">→</span>
                      <span><strong>Full Clearance (90 days):</strong> Add background check + 2 professional references (7-10 days processing)</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <button
                    onClick={loadContractorDetails}
                    disabled={isLoadingDetails}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingDetails ? 'Loading Dashboard...' : 'View Verification Dashboard'}
                  </button>
                  <button
                    onClick={() => {
                      setContractor(null);
                      setContractorDetails(null);
                      setError(null);
                    }}
                    className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Create Another Account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/50 backdrop-blur rounded-lg p-4">
            <div className="text-2xl font-bold text-indigo-600">24h</div>
            <div className="text-sm text-gray-600">Provisional</div>
          </div>
          <div className="bg-white/50 backdrop-blur rounded-lg p-4">
            <div className="text-2xl font-bold text-indigo-600">7-10d</div>
            <div className="text-sm text-gray-600">Full Clearance</div>
          </div>
          <div className="bg-white/50 backdrop-blur rounded-lg p-4">
            <div className="text-2xl font-bold text-indigo-600">$249</div>
            <div className="text-sm text-gray-600">Per Verification</div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <a className="underline hover:text-gray-700" href="/privacy.html">Privacy</a>
          <span className="mx-2">•</span>
          <a className="underline hover:text-gray-700" href="/terms.html">Terms</a>
        </div>
      </div>
    </div>
  );
}

export default App;
