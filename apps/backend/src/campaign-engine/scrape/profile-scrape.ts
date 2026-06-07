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

/** Name / headline / location from the profile top card.
 *
 * Primary path uses LinkedIn's Artdeco *utility* classes (`text-body-medium`,
 * `text-body-small`, `t-black--light`) — these are stable, NOT the hashed
 * component classes. Falls back to the old contact-info-section heuristic if
 * those miss. A sanitizer rejects the junk the old heuristic used to capture
 * as a headline (modal a11y text, "Visit my website", a bare degree badge, an
 * education/school line, etc.).
 */
export async function extractTopCard(page: any): Promise<ProfileCardData> {
    return page.evaluate(() => {
        const data: any = { name: null, headline: null, location: null };

        const stripPronouns = (s: string | null): string | null => {
            if (!s) return s;
            return s.replace(/\b(He\/Him|She\/Her|They\/Them)\b/g, '').trim();
        };

        // Reject strings that are clearly NOT a professional headline.
        const isJunkHeadline = (t: string | null, name: string | null): boolean => {
            if (!t) return true;
            const s = t.trim();
            if (s.length < 2) return true;
            if (name && s === name) return true;
            return (
                /degree connection/i.test(s) ||         // "3rd+ degree connection"
                /modal window/i.test(s) ||              // "This is a modal window."
                /media could not be loaded/i.test(s) || // video-player error overlay
                /^(Beginning|End) of dialog window/i.test(s) ||
                /^\s*(\d[\d,]*)\s+(followers?|connections?|mutual)/i.test(s) ||
                /^(Visit my website|Contact info|Message|More|Follow|Connect|Pending|Open to|Add profile section)\b/i.test(s) ||
                /^(He\/Him|She\/Her|They\/Them)$/i.test(s)
            );
        };

        // Some headline elements include the name run with no separator
        // ("khushhal kaushikFounder & CEO…"). Strip a leading name prefix.
        const stripLeadingName = (t: string, name: string | null): string => {
            if (name && t.startsWith(name)) return t.slice(name.length).trim();
            return t;
        };

        const main = (document.querySelector('main, [role="main"]') as HTMLElement) || document.body;

        // --- Name: the profile H1 ---
        const h1 = main.querySelector('h1');
        if (h1) data.name = stripPronouns((h1 as HTMLElement).innerText?.trim() || null);

        // --- Headline: the text-body-medium line directly under the name ---
        const headlineCandidates = Array.from(
            main.querySelectorAll('div.text-body-medium, .text-body-medium.break-words')
        )
            .map((el: any) => stripLeadingName((el.innerText || el.textContent || '').trim(), data.name))
            .filter((t: string) => t.length > 0);
        const headline = headlineCandidates.find((t) => !isJunkHeadline(t, data.name));
        if (headline) data.headline = headline;

        // --- Location: the muted small line (t-black--light, inline) ---
        const locEl =
            main.querySelector('span.text-body-small.inline.t-black--light.break-words') ||
            main.querySelector('.pv-text-details__left-panel .text-body-small');
        if (locEl) {
            const loc = ((locEl as HTMLElement).innerText || '').trim();
            if (loc && !/connections?|followers?|Contact info/i.test(loc)) data.location = loc;
        }

        // --- Fallback: old contact-info-section heuristic (relaxed) ---
        if (!data.name || !data.headline || !data.location) {
            const contactLinks = Array.from(document.querySelectorAll('a')).filter(
                (a: any) =>
                    a.innerText?.toLowerCase().includes('contact info') || (a.id && a.id.includes('contact-info'))
            );
            if (contactLinks.length > 0) {
                const section = contactLinks[0].closest('section');
                if (section) {
                    const uniqueDetails = [
                        ...new Set(
                            (section as HTMLElement).innerText
                                .split('\n')
                                .map((t: string) => t.trim())
                                .filter((t: string) => t.length > 0 && !t.includes('connections') && !t.includes('Message'))
                        ),
                    ] as string[];

                    if (!data.name && uniqueDetails.length > 0) data.name = stripPronouns(uniqueDetails[0]);
                    if (!data.headline) {
                        // Real headlines CAN contain commas ("Founder, CEO") — the old
                        // no-comma filter is gone; rely on the junk sanitizer instead.
                        const h = uniqueDetails.find(
                            (t: string) => t.length > 8 && t !== data.name && !isJunkHeadline(t, data.name)
                        );
                        if (h) data.headline = h;
                    }
                    if (!data.location) {
                        data.location =
                            uniqueDetails.find((t: string) => t.includes(',') && !t.includes('Mutual')) || null;
                    }
                }
            }
        }

        // Final pass: strip a leading name prefix now that data.name is fully
        // resolved (it may have come from the fallback AFTER the headline was
        // read, so the per-candidate strip above could have missed it). Also
        // drop a headline that's now just the name or pure junk.
        if (data.headline) {
            data.headline = stripLeadingName(data.headline, data.name);
            if (isJunkHeadline(data.headline, data.name)) data.headline = null;
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

/** First experience entry: company, job title, company URL.
 *
 * Company name is taken PRIMARILY from the first company logo's `alt`
 * ("Meril logo" -> "Meril") inside the Experience section — that is the only
 * clean, structured source. The old `span[aria-hidden]` heuristic kept landing
 * on the headline banner / employment-type line ("Bynd | Generative AI… ",
 * "Company · Full-time"), which the email-finder can't resolve to a domain.
 * Job title comes from the first job block's deduped text lines, accounting for
 * LinkedIn's "umbrella" layout (company name leads the block, title sits lower).
 * Mirrors testscripts/phase2_lead_company&jobpost.js.
 */
export async function extractExperience(page: any): Promise<ProfileExperienceData> {
    return page.evaluate(() => {
        const data: any = { company: null, jobTitle: null, companyUrl: null };

        const headers = Array.from(document.querySelectorAll('h2, div[role="heading"], span[aria-hidden="true"]'));
        const header =
            headers.find((h: any) => {
                const txt = (h.innerText || h.textContent || '').trim().toLowerCase();
                return txt === 'experience' || txt.startsWith('experience\n') || txt === 'experience ';
            }) || document.querySelector('#experience');

        const section: Element | null = header
            ? (header as HTMLElement).closest('section') || ((header as HTMLElement).parentElement as Element)
            : null;
        if (!section) return data;

        // --- Company URL + clean company NAME from the first company logo. ---
        const companyLink = section.querySelector('a[href*="/company/"]');
        if (companyLink) {
            data.companyUrl = (companyLink as HTMLAnchorElement).href?.split('?')[0] || null;
        }
        const logoImg = section.querySelector('a[href*="/company/"] img[alt]');
        const alt = logoImg?.getAttribute('alt')?.replace(/\s*logo\s*$/i, '').trim();
        if (alt && alt.length > 1) data.company = alt;

        const firstJob = section.querySelector(
            'ul > li, .pvs-list__paged-list-item, .artdeco-list__item, [data-view-name="profile-component-entity"]'
        );
        if (firstJob) {
            // Deduped, ordered text lines of the first job block.
            const rawLines = ((firstJob as HTMLElement).innerText || '')
                .split('\n')
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0);
            const details: string[] = [];
            for (let i = 0; i < rawLines.length; i++) {
                if (i === 0 || rawLines[i] !== rawLines[i - 1]) details.push(rawLines[i]);
            }

            // Job title: in the "umbrella" layout the first line is the company
            // name and the title sits further down; otherwise line 0 is the title.
            if (details.length > 0) {
                if (data.company && details[0].toLowerCase().includes(data.company.toLowerCase())) {
                    data.jobTitle = details.length > 3 ? details[3] : details[1] || null;
                } else {
                    data.jobTitle = details[0];
                }
            }

            // If the logo alt missed, recover company from the employment line
            // ("Company · Full-time") rather than from the banner headline.
            if (!data.company) {
                const empLine = details.find((l) =>
                    / · (Full-time|Part-time|Internship|Contract|Freelance|Self-employed)/i.test(l)
                );
                if (empLine) data.company = empLine.split('·')[0].trim() || null;
            }
        }

        // Last-resort legacy span heuristic, only if we still have nothing.
        if (!data.jobTitle || !data.company) {
            const spans = Array.from(section.querySelectorAll('span[aria-hidden="true"]'))
                .map((s: any) => (s.innerText || s.textContent || '').trim())
                .filter((t: string) => t.length > 0);
            if (!data.jobTitle && spans.length > 0) data.jobTitle = spans[0];
            if (!data.company && spans.length > 1) data.company = spans[1].split('·')[0].trim() || null;
        }

        return data;
    });
}

export interface ExperienceEntry {
    title: string | null;
    company: string | null;
    dateRange: string | null;
}
export interface EducationEntry {
    school: string | null;
    degree: string | null;
    dateRange: string | null;
}

// Shared DOM walker for the "Experience"/"Education" list sections. LinkedIn
// marks each visible text run with an aria-hidden span; the first is the
// title/school, the next lines are company/degree and date range. Best-effort:
// returns [] if the section/markup isn't found rather than throwing.
async function extractSectionEntries(page: any, sectionId: string, headerText: string, max: number): Promise<any[]> {
    return page.evaluate(
        (args: { sectionId: string; headerText: string; max: number }) => {
            const { sectionId, headerText, max } = args;
            const headers = Array.from(document.querySelectorAll('h2, div[role="heading"]'));
            const header =
                headers.find((h: any) => {
                    const txt = (h.innerText || h.textContent || '').trim().toLowerCase();
                    return txt === headerText || txt.startsWith(headerText + '\n');
                }) || document.querySelector('#' + sectionId);
            const section: Element | null = header
                ? (header as HTMLElement).closest('section') || ((header as HTMLElement).parentElement as Element)
                : null;
            if (!section) return [];

            const items = Array.from(
                section.querySelectorAll(
                    'li.artdeco-list__item, .pvs-list__paged-list-item, [data-view-name="profile-component-entity"]'
                )
            ).slice(0, max);

            return items
                .map((item) => {
                    const lines = Array.from(item.querySelectorAll('span[aria-hidden="true"]'))
                        .map((s: any) => (s.innerText || s.textContent || '').trim())
                        .filter((t: string) => t.length > 0);
                    if (lines.length === 0) return null;
                    const dateLine = lines.find((l) => /\b(19|20)\d{2}\b|present|yr|mo/i.test(l)) || null;
                    return {
                        primary: lines[0] || null,
                        secondary: lines[1] ? lines[1].split('·')[0].trim() : null,
                        dateRange: dateLine,
                    };
                })
                .filter(Boolean);
        },
        { sectionId, headerText, max }
    );
}

/** Up to `max` experience entries (title / company / date range). */
export async function extractExperienceList(page: any, max = 5): Promise<ExperienceEntry[]> {
    const rows = await extractSectionEntries(page, 'experience', 'experience', max);
    return rows.map((r: any) => ({ title: r.primary, company: r.secondary, dateRange: r.dateRange }));
}

/** Up to `max` education entries (school / degree / date range). */
export async function extractEducationList(page: any, max = 3): Promise<EducationEntry[]> {
    const rows = await extractSectionEntries(page, 'education', 'education', max);
    return rows.map((r: any) => ({ school: r.primary, degree: r.secondary, dateRange: r.dateRange }));
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
