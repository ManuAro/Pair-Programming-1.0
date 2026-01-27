import axios from 'axios';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export function buildGitHubAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scopes.join(' '),
    state: params.state,
  });

  return `${GITHUB_AUTH_URL}?${search.toString()}`;
}

export async function exchangeGitHubCode(config: GitHubAuthConfig, code: string): Promise<GitHubTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await axios.post(GITHUB_TOKEN_URL, body.toString(), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data as GitHubTokenResponse;
}

export async function fetchGitHubProfile(accessToken: string): Promise<{
  user: any;
  emails: Array<{ email: string; primary: boolean; verified: boolean }>; 
}> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'contractor-passport',
  };

  const [userResponse, emailsResponse] = await Promise.all([
    axios.get(`${GITHUB_API_BASE}/user`, { headers }),
    axios.get(`${GITHUB_API_BASE}/user/emails`, { headers }),
  ]);

  return {
    user: userResponse.data,
    emails: emailsResponse.data,
  };
}
