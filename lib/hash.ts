import { createHash, randomBytes } from 'crypto';

const ALGORITHM = 'sha256';

/**
 * Hash a string (email or verification token) for storage.
 * Never store plain email or token in DB.
 */
export function hashString(value: string): string {
  return createHash(ALGORITHM).update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Generate a secure random token for email verification.
 * Store only its hash in DB; send plain token in verification link.
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}
