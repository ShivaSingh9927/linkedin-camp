import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const AUTH_TAG_LENGTH = 16; // GCM standard auth tag length

// Ensure key is 32 bytes (256 bits). Use CRM_ENCRYPTION_KEY if provided, fallback to dev key.
const ENCRYPTION_KEY = process.env.CRM_ENCRYPTION_KEY
  ? crypto.createHash('sha256').update(process.env.CRM_ENCRYPTION_KEY).digest()
  : Buffer.from('d6f3e1a0b5c4d3e2f1a0b9c8d7e6f5a4d6f3e1a0b5c4d3e2f1a0b9c8d7e6f5a4', 'hex');

/**
 * Encrypts cleartext using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:encrypted_hex
 */
export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts standard format (iv_hex:auth_tag_hex:encrypted_hex) using AES-256-GCM.
 */
export function decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
