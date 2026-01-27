export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Contractor Passport API',
    version: '0.1.0',
    description: 'API for contractor onboarding, verification, and credential issuance.',
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local' },
  ],
  tags: [
    { name: 'health' },
    { name: 'contractors' },
    { name: 'verifications' },
    { name: 'credentials' },
    { name: 'oauth' },
    { name: 'keys' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'OK',
          },
        },
      },
    },
    '/api/contractors/onboard': {
      post: {
        tags: ['contractors'],
        summary: 'Onboard contractor',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OnboardRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '409': { description: 'Already exists' },
        },
      },
    },
    '/api/contractors/{id}': {
      get: {
        tags: ['contractors'],
        summary: 'Get contractor',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Contractor' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/contractors/{id}/verifications': {
      post: {
        tags: ['verifications'],
        summary: 'Create verification',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateVerificationRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '404': { description: 'Contractor not found' },
        },
      },
    },
    '/api/verifications/{id}': {
      patch: {
        tags: ['verifications'],
        summary: 'Update verification status',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateVerificationRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Updated' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/contractors/{id}/credentials': {
      post: {
        tags: ['credentials'],
        summary: 'Issue credential',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '201': { description: 'Issued' },
          '400': { description: 'Not eligible' },
        },
      },
    },
    '/api/credentials/{id}/verify': {
      get: {
        tags: ['credentials'],
        summary: 'Verify credential',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Valid' },
          '400': { description: 'Invalid' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/credentials/{id}/revoke': {
      post: {
        tags: ['credentials'],
        summary: 'Revoke credential',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RevokeCredentialRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Revoked' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/credentials/{id}/status': {
      get: {
        tags: ['credentials'],
        summary: 'Credential status',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Status' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/api/oauth/github/start': {
      get: {
        tags: ['oauth'],
        summary: 'Start GitHub OAuth',
        parameters: [
          { name: 'contractorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'returnTo', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Auth URL' },
          '404': { description: 'Contractor not found' },
        },
      },
    },
    '/api/oauth/github/callback': {
      get: {
        tags: ['oauth'],
        summary: 'GitHub OAuth callback',
        parameters: [
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Verification updated' },
          '400': { description: 'Invalid state' },
        },
      },
    },
    '/api/oauth/linkedin/start': {
      get: {
        tags: ['oauth'],
        summary: 'Start LinkedIn OAuth',
        parameters: [
          { name: 'contractorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'returnTo', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Auth URL' },
          '404': { description: 'Contractor not found' },
        },
      },
    },
    '/api/oauth/linkedin/callback': {
      get: {
        tags: ['oauth'],
        summary: 'LinkedIn OAuth callback',
        parameters: [
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Verification updated' },
          '400': { description: 'Invalid state' },
        },
      },
    },
    '/.well-known/jwks.json': {
      get: {
        tags: ['keys'],
        summary: 'JWKS public keys',
        responses: {
          '200': { description: 'JWKS' },
        },
      },
    },
  },
  components: {
    schemas: {
      OnboardRequest: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      CreateVerificationRequest: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['identity', 'github', 'linkedin', 'background_check', 'reference'] },
          provider: { type: 'string' },
          data: { type: 'object', additionalProperties: true },
        },
      },
      UpdateVerificationRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'verified', 'failed'] },
          data: { type: 'object', additionalProperties: true },
        },
      },
      RevokeCredentialRequest: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
          actor: { type: 'string' },
        },
      },
    },
  },
};
