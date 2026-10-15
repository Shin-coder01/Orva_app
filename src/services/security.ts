import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'orva.pin-hash.v1';
const BIOMETRIC_KEY = 'orva.biometric-enabled';
const LOCK_TIMEOUT_KEY = 'orva.lock-timeout-ms';
const DEFAULT_LOCK_TIMEOUT = 60000;

type StoredPin = { salt: string; digest: string };

async function readPin(): Promise<StoredPin | null> {
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredPin>;
    return typeof value.salt === 'string' && typeof value.digest === 'string'
      ? { salt: value.salt, digest: value.digest }
      : null;
  } catch {
    return null;
  }
}

export async function hasPin(): Promise<boolean> {
  return (await readPin()) !== null;
}

export async function savePin(pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN length is invalid');
  const salt = Crypto.randomUUID();
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt, digest } satisfies StoredPin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await readPin();
  if (!stored) return false;
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${stored.salt}:${pin}`);
  return digest === stored.digest;
}

export async function removePin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
}

export async function getBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
}

export async function getLockTimeout(): Promise<number> {
  const value = Number(await SecureStore.getItemAsync(LOCK_TIMEOUT_KEY));
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_LOCK_TIMEOUT;
}

export async function setLockTimeout(value: number): Promise<void> {
  await SecureStore.setItemAsync(LOCK_TIMEOUT_KEY, String(value));
}
