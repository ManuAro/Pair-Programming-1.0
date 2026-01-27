import axios from 'axios';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

export interface LinkedInAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
}

export function buildLinkedInAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const search = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scopes.join(' '),
    state: params.state,
  });

  return `${LINKEDIN_AUTH_URL}?${search.toString()}`;
}

export async function exchangeLinkedInCode(config: LinkedInAuthConfig, code: string): Promise<LinkedInTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await axios.post(LINKEDIN_TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data as LinkedInTokenResponse;
}

export async function fetchLinkedInProfile(accessToken: string): Promise<any> {
  const response = await axios.get(LINKEDIN_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
