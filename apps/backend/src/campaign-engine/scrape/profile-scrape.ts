/**
 * Shared, read-only LinkedIn profile scrapers.
 *
 * These page.evaluate extractors are used by BOTH the profile-visit campaign
 * node (scraping a lead/recipient) and the self-profile enrichment job
 * (scraping the user's OWN profile after login). Keeping them in one place
 * means a LinkedIn DOM change is fixed once, not in two diverging copies.
 *
 * Nothing here touches the DB or mutates LinkedIn state — pure reads.
 */

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export interface ProfileCardData {
    name: string | null;
    headline: string | null;
    location: string | null;
}

export interface ProfileExperienceData {
    company: string | null;
    jobTitle: string | null;
    companyUrl: string | null;
}

/** Aggressive scroll to force lazy-loaded sections (esp. Experience) to render. */
export async function scrollProfile(page: any): Promise<void> {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(3000);

    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await wait(1500);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(1000);

    for (let i = 0; i < 6; i++) {
        const found = await page.evaluate(() => {
            const hs = document.querySelectorAll('h2');
            return Array.from(hs).some((h: any) => h.innerText?.trim()?.toLowerCase() === 'experience');
        });
        if (found) break;
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await wait(1200 * (i + 1));
    }

    await page.evaluate(() => {
        const h2s = document.querySelectorAll('h2');
        const expH2 = Array.from(h2s).find((h: any) => h.innerText?.trim()?.toLowerCase() === 'experience');
        if (expH2) (expH2 as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await wait(2000);

    await page.evaluate(() => {
        for (let i = 0; i < 3; i++) window.scrollBy(0, 800);
    });
    await wait(3000);
}

/** Name / headline / location from the top card's contact-info section. */
export async function extractTopCard(page: any): Promise<ProfileCardData> {
    return page.evaluate(() => {
        const data: any = { name: null, headline: null, location: null };

        const contactLinks = Array.from(document.querySelectorAll('a')).filter(
            (a: any) =>
                a.innerText?.toLowerCase().includes('contact info') || (a.id && a.id.includes('contact-info'))
        );

        if (contactLinks.length > 0) {
            const section = contactLinks[0].closest('section');
            if (section) {
                const rawText = section.innerText
                    .split('\n')
                    .map((t: string) => t.trim())
                    .filter((t: string) => t.length > 0 && !t.includes('connections') && !t.includes('Message'));

                const uniqueDetails = [...new Set(rawText)] as string[];

                if (uniqueDetails.length > 0) {
                    data.name = uniqueDetails[0];
                    ['He/Him', 'She/Her', 'They/Them'].forEach((p: string) => {
                        if (data.name?.endsWith(p)) data.name = data.name.replace(p, '').trim();
                    });
                }

                const potentialHeadlines = uniqueDetails.filter(
                    (t: string) => t.length > 15 && t !== data.name && !t.includes(',')
                );
                if (potentialHeadlines.length > 0) data.headline = potentialHeadlines[0];

                data.location = uniqueDetails.find((t: string) => t.includes(',') && !t.includes('Mutual')) || null;
            }
        }
        return data;
    });
}

/** The "About" section free text. */
export async function extractAbout(page: any): Promise<string | null> {
    return page.evaluate(() => {
        const h2s = Array.from(document.querySelectorAll('h2'));
        const aboutH2 = h2s.find((h: any) => h.innerText?.trim()?.toLowerCase() === 'about');
        if (!aboutH2) return null;

        const section = (aboutH2 as HTMLElement).closest('section');
        if (!section) return null;

        const textBox =
            section.querySelector('.display-flex.ph5.pv3, [data-testid="expandable-text-box"]') || section;
        return (textBox as HTMLElement).innerText?.replace('About\n', '').trim() || null;
    });
}

/** First experience entry: company, job title, company URL. */
export async function extractExperience(page: any): Promise<ProfileExperienceData> {
    return page.evaluate(() => {
        const data: any = { company: null, jobTitle: null, companyUrl: null };

        const headers = Array.from(document.querySelectorAll('h2, div[role="heading"]'));
        const header =
            headers.find((h: any) => {
                const txt = (h.innerText || h.textContent || '').trim().toLowerCase();
                return txt === 'experience' || txt.startsWith('experience\n') || txt === 'experience ';
            }) || document.querySelector('#experience');

        const section: Element | null = header
            ? (header as HTMLElement).closest('section') || ((header as HTMLElement).parentElement as Element)
            : null;
        if (!section) return data;

        const companyLink = section.querySelector('a[href*="/company/"]');
        if (companyLink) {
            data.companyUrl = (companyLink as HTMLAnchorElement).href?.split('?')[0] || null;
        }

        const firstJob = section.querySelector(
            'ul > li, .pvs-list__paged-list-item, .artdeco-list__item, [data-view-name="profile-component-entity"]'
        );
        if (!firstJob) return data;

        const spans = Array.from(firstJob.querySelectorAll('span[aria-hidden="true"]'))
            .map((s: any) => (s.innerText || s.textContent || '').trim())
            .filter((t: string) => t.length > 0);

        if (spans.length > 0) data.jobTitle = spans[0];
        if (spans.length > 1) data.company = spans[1].split('·')[0].trim() || null;

        if (!data.company) {
            const logoImg =
                firstJob.querySelector('img[alt]') || section.querySelector('a[href*="/company/"] img[alt]');
            const alt = logoImg?.getAttribute('alt')?.replace(/\s*logo\s*$/i, '').trim();
            if (alt && alt.length > 1) data.company = alt;
        }

        return data;
    });
}

export interface RecentPost {
    url: string | null;
    content: string;
    postedAgo: string | null; // relative time as LinkedIn shows it, e.g. "2w"
}

/**
 * Scrape the user's most recent posts straight from their activity feed
 * (/recent-activity/shares/). Reads text inline from each post wrapper rather
 * than navigating into each post — faster and a lighter footprint. Skips
 * reshares with no original commentary. Returns up to `limit` posts.
 */
export async function scrapeRecentPosts(page: any, profileUrl: string, limit = 3): Promise<RecentPost[]> {
    const cleanUrl = profileUrl.split('?')[0].replace(/\/$/, '');
    const activityUrl = cleanUrl + '/recent-activity/shares/';

    await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wait(randomRange(4000, 6000));

    await page
        .waitForSelector(
            'div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]',
            { timeout: 15000 }
        )
        .catch(() => {});

    // Scroll to load a few posts and expand any "…more" truncation.
    for (let i = 0; i < limit + 2; i++) {
        await page.mouse.wheel(0, 900);
        await wait(1500);
    }
    try {
        const moreButtons = await page.locator('button[data-testid="expandable-text-button"]').all();
        for (const btn of moreButtons.slice(0, limit + 2)) {
            await btn.click({ force: true }).catch(() => {});
            await wait(300);
        }
    } catch {}

    const posts: RecentPost[] = await page.evaluate((max: number) => {
        const wrappers = Array.from(
            document.querySelectorAll(
                'div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]'
            )
        );
        const out: { url: string | null; content: string; postedAgo: string | null }[] = [];
        const seen = new Set<string>();

        for (const w of wrappers) {
            if (out.length >= max) break;

            const textEl = w.querySelector('.update-components-text, [data-testid="expandable-text-box"]');
            const content = (textEl as HTMLElement)?.innerText?.trim() || '';
            if (!content || content.length < 20) continue; // skip empty reshares / reactions
            if (seen.has(content)) continue;
            seen.add(content);

            const urn = w.getAttribute('data-urn');
            const url = urn ? `https://www.linkedin.com/feed/update/${urn}/` : null;

            // Relative timestamp lives in the actor sub-description, e.g. "2w • Edited".
            const timeEl = w.querySelector('.update-components-actor__sub-description, time');
            const postedAgoRaw = (timeEl as HTMLElement)?.innerText?.trim() || null;
            const postedAgo = postedAgoRaw ? postedAgoRaw.split('•')[0].trim().split('\n')[0].trim() : null;

            out.push({ url, content, postedAgo });
        }
        return out;
    }, limit);

    return posts;
}

export interface OwnProfileData {
    name: string | null;
    headline: string | null;
    location: string | null;
    about: string | null;
    company: string | null;
    jobTitle: string | null;
    companyUrl: string | null;
}

/**
 * Navigate to a profile URL and scrape the core fields. Intended for the
 * user's OWN profile (no connection-state / contact-info modal needed).
 * Throws if the session is invalid (auth wall / checkpoint redirect).
 */
export async function scrapeOwnProfile(page: any, profileUrl: string): Promise<OwnProfileData> {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wait(randomRange(12000, 18000));

    const url = page.url();
    if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
        throw new Error(`Session invalid. Redirected to: ${url}`);
    }

    await scrollProfile(page);

    const [card, about, exp] = await Promise.all([
        extractTopCard(page).catch(() => ({ name: null, headline: null, location: null })),
        extractAbout(page).catch(() => null),
        extractExperience(page).catch(() => ({ company: null, jobTitle: null, companyUrl: null })),
    ]);

    return {
        name: card.name,
        headline: card.headline,
        location: card.location,
        about,
        company: exp.company,
        jobTitle: exp.jobTitle,
        companyUrl: exp.companyUrl,
    };
}
