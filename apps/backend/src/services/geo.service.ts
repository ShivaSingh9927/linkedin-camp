import { prisma } from '@repo/db';

/**
 * Country resolution for proxy assignment.
 *
 * A LinkedIn session is bound to the egress IP it was born on, so the proxy a
 * user gets must match the country their LinkedIn account presents as. We
 * resolve that country in priority order:
 *
 *   1. User.actualCountry, if already set — an EXPLICIT value that we never
 *      auto-overwrite. This is what makes persona accounts work: an operator
 *      sitting in India running a US LinkedIn account has actualCountry='US',
 *      and no amount of India-looking traffic will flip it back.
 *   2. Geo-lookup of the request IP — the automatic path for real signups, so a
 *      user in the US lands on a US proxy without anyone touching the DB.
 *   3. DEFAULT_COUNTRY ('IN') — the historical behaviour, kept as the floor.
 *
 * The lookup runs at most ONCE per user (we persist the answer), so this stays
 * a single fail-soft network call rather than a hot path. Deliberately no
 * offline geo dataset: those cost 50-100MB of RAM in every process, and the
 * worker box's memory is already governed by live Chromium instances.
 */

const DEFAULT_COUNTRY = 'IN';

/**
 * Providers are tried in order until one answers. Every one of these is a free
 * tier, so rate-limiting (429) is normal rather than exceptional — a chain
 * means one provider throttling us doesn't silently disable country detection.
 * Set GEO_LOOKUP_URL to pin a single provider (e.g. a tokened ipinfo URL).
 */
const GEO_PROVIDERS = process.env.GEO_LOOKUP_URL
    ? [process.env.GEO_LOOKUP_URL]
    : [
          'https://ipinfo.io/{ip}/country',   // plain text: "US"
          'https://ipwho.is/{ip}?fields=country_code', // json: {"country_code":"US"}
          'https://ipapi.co/{ip}/country/',   // plain text
      ];
const GEO_LOOKUP_TIMEOUT_MS = parseInt(process.env.GEO_LOOKUP_TIMEOUT_MS || '4000', 10);

/**
 * Pull a 2-letter country code out of a provider response, accepting either a
 * bare code or a JSON object (providers disagree on shape). Returns null for
 * anything else — an error page or rate-limit notice must not become a
 * "country".
 */
function parseCountryCode(body: string): string | null {
    const trimmed = body.trim();
    if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
    try {
        const json = JSON.parse(trimmed);
        const candidate = json?.country_code ?? json?.countryCode ?? json?.country;
        if (typeof candidate === 'string' && /^[A-Za-z]{2}$/.test(candidate.trim())) {
            return candidate.trim().toUpperCase();
        }
    } catch {
        // not JSON — fall through
    }
    return null;
}

/**
 * Best-effort client IP. Express sits behind a load balancer in prod, so the
 * socket address is the LB — X-Forwarded-For's FIRST entry is the real client.
 */
export function clientIpFromRequest(req: any): string | null {
    const fwd = req?.headers?.['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) {
        const first = fwd.split(',')[0]?.trim();
        if (first) return first;
    }
    if (Array.isArray(fwd) && fwd.length > 0) {
        const first = String(fwd[0]).split(',')[0]?.trim();
        if (first) return first;
    }
    const direct = req?.ip || req?.socket?.remoteAddress || null;
    return direct ? String(direct) : null;
}

/** Private/loopback ranges can't be geolocated — don't waste a lookup on them. */
function isRoutableIp(ip: string): boolean {
    const clean = ip.replace(/^::ffff:/, '');
    if (clean === '::1' || clean === '127.0.0.1') return false;
    if (/^10\./.test(clean)) return false;
    if (/^192\.168\./.test(clean)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(clean)) return false;
    if (/^169\.254\./.test(clean)) return false;
    if (/^f[cd]/i.test(clean)) return false; // fc00::/7 unique-local
    return true;
}

/**
 * Geo-locate an IP to a 2-letter country code. Returns null on any failure —
 * callers must treat "unknown" as "leave the current value alone", never as a
 * reason to reassign a proxy.
 */
export async function countryFromIp(ip: string | null): Promise<string | null> {
    if (!ip || !isRoutableIp(ip)) return null;

    const bare = ip.replace(/^::ffff:/, '');

    for (const template of GEO_PROVIDERS) {
        const url = template.replace('{ip}', encodeURIComponent(bare));
        const host = (() => { try { return new URL(url).host; } catch { return template; } })();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GEO_LOOKUP_TIMEOUT_MS);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) {
                console.warn(`[GEO] ${host} returned ${res.status} for ${bare}`);
                continue;
            }
            const code = parseCountryCode(await res.text());
            if (code) return code;
            console.warn(`[GEO] ${host} returned an unusable body for ${bare}`);
        } catch (e: any) {
            console.warn(`[GEO] ${host} lookup failed for ${bare}: ${e?.message}`);
        } finally {
            clearTimeout(timer);
        }
    }

    console.warn(`[GEO] All providers failed for ${bare} — country stays unknown.`);
    return null;
}

/**
 * Fill in User.actualCountry from the request IP if — and only if — it is not
 * already set. Returns the country now on record (or null if still unknown).
 *
 * Call this before getOrAssignProxy on any request-bound path, so the proxy
 * picker sees a country instead of falling back to the default.
 */
export async function captureUserCountry(userId: string, req: any): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { actualCountry: true },
    });
    if (!user) return null;
    if (user.actualCountry) return user.actualCountry; // explicit value — never overwrite

    const detected = await countryFromIp(clientIpFromRequest(req));
    if (!detected) return null;

    await prisma.user.update({
        where: { id: userId },
        data: { actualCountry: detected },
    });
    console.log(`[GEO] Captured actualCountry=${detected} for user ${userId}`);
    return detected;
}
