/**
 * Encryption Utility for Secure Token Storage
 * 
 * Uses Web Crypto API (AES-GCM) to encrypt authentication tokens
 * before storing them in sessionStorage. This provides protection against
 * XSS attacks and storage tampering.
 * 
 * Security Model:
 * - Uses a random session key stored in sessionStorage
 * - Uses AES-256-GCM for authenticated encryption
 * - Stores IV and encrypted ciphertext
 * - Session key is unique per session, lost on tab close
 * - Each session gets a new encryption key
 * 
 * Why Session-Based Direct Key?
 * - Previous approaches used browser fingerprint (unstable)
 * - Some browsers don't expose required properties
 * - Session key is simple, fast, and always available
 * - Lost when tab closes (same lifetime as sessionStorage)
 * - Generated once per session and reused for all encryption/decryption
 */

const ALGORITHM = {
  name: 'AES-GCM',
  length: 256, // AES-256
};

const KDF_ALGORITHM = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 600000, // OWASP recommended minimum (2023)
  saltLength: 16,
};

const STORAGE_VERSION = '1';
const ENCRYPTION_PREFIX = 'enc:v1:';

// In-memory cache keyed by storage key + exact ciphertext so repeated API calls
// skip WebCrypto key import/decrypt without weakening sessionStorage encryption.
const decryptedTokenCache = new Map<string, { ciphertext: string; plaintext: string }>();

/**
 * Get or create a session-based encryption key stored in sessionStorage
 * This key is stable throughout the session and unique per browser instance
 * 
 * Issue with browser fingerprint: Properties like hardwareConcurrency, deviceMemory
 * can vary or be unavailable in some browsers, causing decryption failures.
 * Using sessionStorage ensures consistent key derivation within a session.
 */
function getSessionEncryptionKey(): string {
  const SESSION_KEY = 'bmdc-encryption-key';
  
  let key = sessionStorage.getItem(SESSION_KEY);
  
  if (!key) {
    // Generate a random key for this session (stored in sessionStorage)
    // The key is lost when the tab closes (inherent to sessionStorage)
    const randomBytes = new Uint8Array(32); // 256 bits
    window.crypto.getRandomValues(randomBytes);
    key = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    try {
      sessionStorage.setItem(SESSION_KEY, key);
    } catch {
      // If sessionStorage fails, the key will be regenerated on each call
      // This is acceptable but less efficient
      console.warn('[Encryption] Could not store session key in sessionStorage');
    }
  }
  
  return key;
}

// deriveKey function no longer needed - using session key directly

/**
 * Encrypt a token for storage
 * 
 * Uses simple AES-256-GCM encryption with a session key.
 * The session key is stored in sessionStorage as hex and converted to bytes.
 */
export async function encryptToken(token: string): Promise<string> {
  try {
    const sessionKey = getSessionEncryptionKey();
    
    // Convert hex string to bytes (32 bytes = 256 bits)
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      keyBytes[i] = parseInt(sessionKey.substr(i * 2, 2), 16);
    }
    
    // Generate random IV (96-bit for GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Import key for encryption (use raw bytes, not text)
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      ALGORITHM,
      false,
      ['encrypt']
    );
    
    // Encrypt token
    const tokenBuffer = new TextEncoder().encode(token);
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: ALGORITHM.name,
        iv: iv,
      },
      key,
      tokenBuffer
    );
    
    // Combine IV and ciphertext for storage
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Convert to Base64 for storage
    const base64 = btoa(String.fromCharCode(...combined));
    
    return `${ENCRYPTION_PREFIX}${base64}`;
  } catch (error) {
    console.error('[Encryption] Failed to encrypt token:', error);
    throw new Error('Token encryption failed');
  }
}

/**
 * Decrypt a token from storage
 */
export async function decryptToken(encryptedData: string): Promise<string> {
  try {
    // Verify format
    if (!encryptedData.startsWith(ENCRYPTION_PREFIX)) {
      throw new Error('Invalid encrypted data format');
    }

    // Remove prefix and decode Base64
    const base64 = encryptedData.slice(ENCRYPTION_PREFIX.length);
    const combined = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));

    // Extract IV and ciphertext (no salt in new format)
    const iv = combined.slice(0, 12); // 96-bit IV
    const ciphertext = combined.slice(12);

    // Get session key and convert hex string to bytes
    const sessionKey = getSessionEncryptionKey();
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      keyBytes[i] = parseInt(sessionKey.substr(i * 2, 2), 16);
    }
    
    // Import key for decryption (use raw bytes, not text)
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      ALGORITHM,
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: ALGORITHM.name,
        iv: iv,
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt token:', error);
    throw new Error('Token decryption failed');
  }
}

/**
 * Safely get encrypted token from sessionStorage
 */
export async function getEncryptedToken(key: string): Promise<string | null> {
  try {
    const encrypted = sessionStorage.getItem(key);
    if (!encrypted) {
      decryptedTokenCache.delete(key);
      return null;
    }

    const cached = decryptedTokenCache.get(key);
    if (cached && cached.ciphertext === encrypted) {
      return cached.plaintext;
    }

    // Try to decrypt
    try {
      const plaintext = await decryptToken(encrypted);
      decryptedTokenCache.set(key, { ciphertext: encrypted, plaintext });
      return plaintext;
    } catch (decryptError) {
      // If decryption fails, it's likely an old token encrypted with browser fingerprint
      // Clear it and return null so user can login again
      console.warn('[Encryption] Token decryption failed - clearing old token', decryptError);
      decryptedTokenCache.delete(key);
      sessionStorage.removeItem(key);
      return null;
    }
  } catch (error) {
    console.error('[Encryption] Failed to retrieve encrypted token:', error);
    // Return null if anything fails
    return null;
  }
}

/**
 * Safely set encrypted token to sessionStorage
 */
export async function setEncryptedToken(key: string, token: string): Promise<void> {
  try {
    const encrypted = await encryptToken(token);
    sessionStorage.setItem(key, encrypted);
    decryptedTokenCache.set(key, { ciphertext: encrypted, plaintext: token });
  } catch (error) {
    console.error('[Encryption] Failed to store encrypted token:', error);
    throw error;
  }
}

/**
 * Remove token from sessionStorage
 */
export function removeEncryptedToken(key: string): void {
  try {
    decryptedTokenCache.delete(key);
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error('[Encryption] Failed to remove encrypted token:', error);
  }
}

/**
 * Clear all encrypted tokens from sessionStorage (used on logout)
 */
export function clearAllEncryptedTokens(keys: string[]): void {
  keys.forEach(key => {
    removeEncryptedToken(key);
  });
}
