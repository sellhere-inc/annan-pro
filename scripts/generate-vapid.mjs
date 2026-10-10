import { createECDH, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const keys = { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: ecdh.getPrivateKey().toString('base64url'), workerSecret: randomBytes(32).toString('hex') };
mkdirSync('.secrets', { recursive: true, mode: 0o700 });
writeFileSync('.secrets/vapid.json', JSON.stringify(keys, null, 2), { mode: 0o600, flag: 'wx' });
console.log('Saved keys to .secrets/vapid.json (ignored by git). Keep the private key server-side.');
console.log('Public key for EXPO_PUBLIC_VAPID_PUBLIC_KEY: ' + keys.publicKey);
