import crypto from 'crypto';

// Personal API keys for the public API. We store only the SHA-256 hash; the
// plaintext is returned to the user exactly once at creation. Format:
//   qampi_live_<48 hex chars>
// The `prefix` (first ~18 chars) is a non-secret display slice for the UI.
const KEY_PREFIX = 'qampi_live_';

export interface GeneratedKey {
    key: string;      // full plaintext — shown once, never stored
    keyHash: string;  // sha256(key) — stored
    prefix: string;   // display slice — stored
}

export function generateApiKey(): GeneratedKey {
    const key = KEY_PREFIX + crypto.randomBytes(24).toString('hex');
    return { key, keyHash: hashApiKey(key), prefix: key.slice(0, 18) };
}

export function hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

export function looksLikeApiKey(token: string | undefined | null): boolean {
    return !!token && token.startsWith(KEY_PREFIX);
}
