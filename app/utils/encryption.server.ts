/**
 * Token Encryption Utilities
 * 
 * Provides AES-256-GCM encryption for sensitive tokens stored in database.
 * This ensures tokens are encrypted at rest and only decrypted when needed.
 * 
 * IMPORTANT: The ENCRYPTION_KEY environment variable must be set.
 * If the key is lost, all encrypted tokens become unrecoverable.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment variables
 * Throws an error if not configured
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  
  // Validate key length (must be 32 bytes / 64 hex characters)
  if (key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes). " +
      `Current length: ${key.length}`
    );
  }
  
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a token using AES-256-GCM
 * 
 * @param token - The plaintext token to encrypt
 * @returns Encrypted string in format "iv:authTag:encrypted"
 * 
 * @example
 * const encrypted = encryptToken("IGQWRNQkd5...");
 * // Returns: "a3f2e1d4b5c6...:8b7c9a2f1e3d...:x9k3m2n4..."
 */
export function encryptToken(token: string): string {
  if (!token) {
    throw new Error("Cannot encrypt empty token");
  }
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag().toString("hex");
    
    // Format: iv:authTag:encrypted
    // This allows us to extract all necessary data for decryption
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error(
      `Failed to encrypt token: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Decrypt a token that was encrypted with encryptToken()
 * 
 * @param encryptedToken - The encrypted string in format "iv:authTag:encrypted"
 * @returns The original plaintext token
 * 
 * @example
 * const plaintext = decryptToken("a3f2e1d4b5c6...:8b7c9a2f1e3d...:x9k3m2n4...");
 * // Returns: "IGQWRNQkd5..."
 */
export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error("Cannot decrypt empty token");
  }
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedToken.split(":");
    
    if (parts.length !== 3) {
      throw new Error(
        "Invalid encrypted token format. Expected 'iv:authTag:encrypted', " +
        `got ${parts.length} parts`
      );
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex")
    );
    
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error(
      `Failed to decrypt token: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Check if a token is already encrypted (has the iv:authTag:encrypted format)
 * 
 * @param token - The token to check
 * @returns True if token appears to be encrypted
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token) return false;
  
  const parts = token.split(":");
  
  // Encrypted tokens have exactly 3 parts separated by colons
  if (parts.length !== 3) return false;
  
  // Each part should be hex encoded
  const hexPattern = /^[0-9a-f]+$/i;
  return parts.every(part => hexPattern.test(part));
}

/**
 * Safely encrypt a token only if it's not already encrypted
 * Useful for migrating existing plaintext tokens
 * 
 * @param token - Token that may or may not be encrypted
 * @returns Encrypted token
 */
export function ensureTokenEncrypted(token: string): string {
  if (isTokenEncrypted(token)) {
    return token;
  }
  return encryptToken(token);
}

/**
 * Test the encryption/decryption functionality
 * Useful for verifying the ENCRYPTION_KEY is configured correctly
 */
export function testEncryption(): boolean {
  try {
    const testToken = "test_token_123456789";
    const encrypted = encryptToken(testToken);
    const decrypted = decryptToken(encrypted);
    
    const isValid = decrypted === testToken;
    
    if (!isValid) {
      console.error("Encryption test failed: Decrypted token doesn't match original");
    }
    
    return isValid;
  } catch (error) {
    console.error("Encryption test failed:", error);
    return false;
  }
}
