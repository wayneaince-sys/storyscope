// Web Crypto helpers — AES-GCM with PBKDF2-derived keys.
// All manuscript content is encrypted at rest in IndexedDB.

const ENC = new TextEncoder();
const DEC = new TextDecoder();

const PBKDF2_ITERATIONS = 250_000;

export interface EncryptedBlob {
  iv: string;        // base64
  salt: string;      // base64
  ciphertext: string; // base64
  v: 1;
}

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.byteLength; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    ENC.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJSON(data: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = ENC.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );
  return {
    iv: b64encode(iv),
    salt: b64encode(salt),
    ciphertext: b64encode(ciphertext),
    v: 1,
  };
}

export async function decryptJSON<T = unknown>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  const salt = b64decode(blob.salt);
  const iv = b64decode(blob.iv);
  const ciphertext = b64decode(blob.ciphertext);
  const key = await deriveKey(passphrase, salt);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    return JSON.parse(DEC.decode(plaintext)) as T;
  } catch (e) {
    throw new Error('Decryption failed — incorrect passphrase or corrupted data.');
  }
}

// A short verifier blob so we can validate a passphrase without decrypting the whole project.
export async function makeVerifier(passphrase: string): Promise<EncryptedBlob> {
  return encryptJSON({ verifier: 'storyscope-v1' }, passphrase);
}

export async function checkVerifier(blob: EncryptedBlob, passphrase: string): Promise<boolean> {
  try {
    const data = await decryptJSON<{ verifier: string }>(blob, passphrase);
    return data.verifier === 'storyscope-v1';
  } catch {
    return false;
  }
}
