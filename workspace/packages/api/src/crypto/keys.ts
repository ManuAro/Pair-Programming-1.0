import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEFAULT_KEY_DIR = path.join(process.cwd(), 'keys');

type KeyPair = {
  publicKeyPem: string;
  privateKeyPem: string;
  jwk: { n: string; e: string };
  kid: string;
};

function readKeyFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeKeyFile(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, { encoding: 'utf8', mode: 0o600 });
}

export function loadOrCreateKeyPair(): KeyPair {
  const envPrivate = process.env.JWT_PRIVATE_KEY;
  const envPublic = process.env.JWT_PUBLIC_KEY;
  const envKid = process.env.JWT_KEY_ID;

  if (envPrivate && envPublic) {
    const publicKeyObj = crypto.createPublicKey(envPublic);
    const jwk = publicKeyObj.export({ format: 'jwk' }) as { n: string; e: string };

    return {
      publicKeyPem: envPublic,
      privateKeyPem: envPrivate,
      jwk,
      kid: envKid || 'contractor-passport-key-1',
    };
  }

  const keyDir = process.env.JWT_KEY_DIR || DEFAULT_KEY_DIR;
  const privatePath = path.join(keyDir, 'jwt-private.pem');
  const publicPath = path.join(keyDir, 'jwt-public.pem');

  const existingPrivate = readKeyFile(privatePath);
  const existingPublic = readKeyFile(publicPath);

  if (existingPrivate && existingPublic) {
    const publicKeyObj = crypto.createPublicKey(existingPublic);
    const jwk = publicKeyObj.export({ format: 'jwk' }) as { n: string; e: string };

    return {
      publicKeyPem: existingPublic,
      privateKeyPem: existingPrivate,
      jwk,
      kid: envKid || 'contractor-passport-key-1',
    };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  writeKeyFile(privatePath, privateKey);
  writeKeyFile(publicPath, publicKey);

  const publicKeyObj = crypto.createPublicKey(publicKey);
  const jwk = publicKeyObj.export({ format: 'jwk' }) as { n: string; e: string };

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    jwk,
    kid: envKid || 'contractor-passport-key-1',
  };
}
