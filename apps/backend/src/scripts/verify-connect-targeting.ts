/**
 * verify-connect-targeting.ts
 *
 * The connect node is the only write node that can act on the WRONG PERSON, so
 * its "am I on the right profile?" guard gets a real test.
 *
 * Focus is the substring trap: `url.includes(slug)` accepts /in/john-smith-123
 * for a lead whose slug is john-smith. LinkedIn slugs are routinely one another's
 * prefixes (name + digits), so this is a live hazard, not a theoretical one.
 *
 * Pure functions — no DB, no network, no browser.
 *
 *   npx ts-node --transpile-only src/scripts/verify-connect-targeting.ts
 */
import { profileSlugFromUrl, isOnLeadProfile, extractSlug } from '../campaign-engine/connection-state';

let pass = 0;
let fail = 0;

function check(name: string, actual: any, expected: any) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}\n       expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const AKASH = 'https://www.linkedin.com/in/akash-upadhyay-1796602b3/';

console.log('\n--- profileSlugFromUrl ---');
check('plain profile', profileSlugFromUrl(AKASH), 'akash-upadhyay-1796602b3');
check('no trailing slash', profileSlugFromUrl('https://www.linkedin.com/in/reidhoffman'), 'reidhoffman');
check('query string stripped (real lead URL from prod)',
    profileSlugFromUrl('https://www.linkedin.com/in/sneh-singh-736977411?utm_source=share_via&utm_medium=member_ios'),
    'sneh-singh-736977411');
check('sub-page resolves to the profile',
    profileSlugFromUrl('https://www.linkedin.com/in/foo-bar/recent-activity/shares/'), 'foo-bar');
check('fragment stripped', profileSlugFromUrl('https://www.linkedin.com/in/foo-bar#experience'), 'foo-bar');
check('uppercase normalised', profileSlugFromUrl('https://www.linkedin.com/in/Foo-Bar/'), 'foo-bar');
check('percent-encoded', profileSlugFromUrl('https://www.linkedin.com/in/jos%C3%A9-garcia/'), 'josé-garcia');
check('feed is not a profile', profileSlugFromUrl('https://www.linkedin.com/feed/'), null);
check('checkpoint is not a profile', profileSlugFromUrl('https://www.linkedin.com/checkpoint/challenge/'), null);
check('empty', profileSlugFromUrl(''), null);

console.log('\n--- isOnLeadProfile: the happy path ---');
check('exact match', isOnLeadProfile(AKASH, AKASH), true);
check('landed without trailing slash',
    isOnLeadProfile('https://www.linkedin.com/in/akash-upadhyay-1796602b3', AKASH), true);
check('landed with tracking params',
    isOnLeadProfile(AKASH + '?trk=people-guest_people_search-card', AKASH), true);
check('landed on a sub-page of the same profile',
    isOnLeadProfile('https://www.linkedin.com/in/akash-upadhyay-1796602b3/details/experience/', AKASH), true);

console.log('\n--- isOnLeadProfile: must REFUSE ---');
check('on the feed (the actual bug: warmup leaves us here)',
    isOnLeadProfile('https://www.linkedin.com/feed/', AKASH), false);
check('on a checkpoint interstitial',
    isOnLeadProfile('https://www.linkedin.com/checkpoint/challenge/', AKASH), false);
check('on the login wall',
    isOnLeadProfile('https://www.linkedin.com/login', AKASH), false);
check('a DIFFERENT member',
    isOnLeadProfile('https://www.linkedin.com/in/someone-else-999/', AKASH), false);

console.log('\n--- the substring trap (why includes() is not enough) ---');
{
    const lead = 'https://www.linkedin.com/in/john-smith/';
    const other = 'https://www.linkedin.com/in/john-smith-123/';
    // Demonstrate the old check would have accepted this.
    const naive = other.toLowerCase().includes(extractSlug(lead).toLowerCase());
    check('naive includes() WOULD have accepted the impostor', naive, true);
    check('isOnLeadProfile rejects the longer slug', isOnLeadProfile(other, lead), false);
    check('and rejects the shorter one in reverse', isOnLeadProfile(lead, other), false);
    check('but still accepts the genuine longer slug against itself', isOnLeadProfile(other, other), true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
