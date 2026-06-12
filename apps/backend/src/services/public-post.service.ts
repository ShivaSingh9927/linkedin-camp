/**
 * public-post.service.ts
 *
 * Login-free fetch of a LinkedIn post's full content.
 *
 * LinkedIn serves individual posts on a GUEST page (pageKey=d_public_post,
 * member-id=0) designed for SEO/crawlers — it embeds a JSON-LD
 * <script type="application/ld+json"> block with the complete post:
 * articleBody (full text, untruncated), headline, datePublished, author,
 * image, like + comment counts. No session, no cookies, no proxy required.
 *
 * This is strictly better than DOM-scraping the post text out of a logged-in
 * /recent-activity page: the data is structured + complete, and the fetch
 * happens OUTSIDE the account's risky LinkedIn session. We still need the
 * activity URN (discovery), which the profile-visit step already captures —
 * the guest *profile* page is anti-scrape walled (HTTP 999), but the guest
 * *post* page is not.
 */
import axios from 'axios';

export interface PublicPost {
    text: string;
    headline?: string;
    publishedAt?: string;
    likes?: number;
    comments?: number;
    imageUrl?: string;
    canonicalUrl?: string;
}

const BROWSER_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

/**
 * Normalize any post reference to a fetchable guest URL.
 * Accepts: a raw `urn:li:activity:123` (or ugcPost/share), a numeric activity
 * id, a `/feed/update/<urn>/` URL, or a `/posts/...` permalink.
 */
export function toPublicPostUrl(ref: string): string | null {
    if (!ref) return null;
    const r = ref.trim();
    if (r.includes('/posts/') || r.includes('/feed/update/')) return r;
    const urn = r.match(/urn:li:(?:activity|ugcPost|share):\d+/)?.[0];
    if (urn) return `https://www.linkedin.com/feed/update/${urn}/`;
    if (/^\d{6,}$/.test(r)) return `https://www.linkedin.com/feed/update/urn:li:activity:${r}/`;
    return null;
}

/**
 * Pure parser: pull the post out of a public-post HTML page's JSON-LD.
 * Exported so it can be unit-tested against a saved fixture with no network.
 */
export function parsePostHtml(html: string): PublicPost | null {
    if (!html) return null;
    // The post text lives in `articleBody` for text posts (SocialMediaPosting)
    // but under `description` for video/image posts (VideoObject/ImageObject) —
    // accept either so we cover all post types.
    const postText = (n: any): string => String(n?.articleBody || n?.description || '').trim();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const m of blocks) {
        let j: any;
        try { j = JSON.parse(m[1]); } catch { continue; }
        const node = Array.isArray(j) ? j.find(x => postText(x)) : j;
        const text = postText(node);
        if (!text) continue;
        const stats = Array.isArray(node.interactionStatistic)
            ? node.interactionStatistic
            : node.interactionStatistic ? [node.interactionStatistic] : [];
        const likes = stats.find((s: any) => /LikeAction/.test(s?.interactionType || ''))?.userInteractionCount;
        return {
            text,
            headline: node.headline || node.name || undefined,
            publishedAt: node.datePublished || undefined,
            likes: typeof likes === 'number' ? likes : undefined,
            comments: typeof node.commentCount === 'number' ? node.commentCount : undefined,
            imageUrl: node.image?.url || node.thumbnailUrl || undefined,
            canonicalUrl: node['@id'] || undefined,
        };
    }
    return null;
}

/**
 * Fetch + parse a post's full content. Returns null on any failure (bot wall,
 * timeout, missing JSON-LD) so callers can fall back to DOM-scraped text.
 */
export async function fetchPublicPostContent(ref: string): Promise<PublicPost | null> {
    const url = toPublicPostUrl(ref);
    if (!url) return null;
    try {
        const resp = await axios.get(url, {
            timeout: 15000,
            maxRedirects: 5,
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            // 999 = LinkedIn anti-scrape; treat as a soft failure, not a throw.
            validateStatus: () => true,
        });
        if (resp.status !== 200 || typeof resp.data !== 'string') {
            console.log(`[public-post] ${url} → HTTP ${resp.status} (no content)`);
            return null;
        }
        const post = parsePostHtml(resp.data);
        if (!post) console.log(`[public-post] ${url} → no JSON-LD post block`);
        return post;
    } catch (err: any) {
        console.log(`[public-post] fetch failed for ${url}: ${err?.message}`);
        return null;
    }
}
