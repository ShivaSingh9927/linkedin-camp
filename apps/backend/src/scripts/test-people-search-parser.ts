/**
 * test-people-search-parser.ts
 *
 * Fixture assertion for parseSearchPeopleHtml — no network, no browser.
 * Runs the ACTUAL service parser over the synthetic fixture and asserts the
 * structured output (name split, degree, headline→jobTitle/company split,
 * location, and exclusion of mutual-connection insight anchors).
 *
 *   npx tsx src/scripts/test-people-search-parser.ts
 *
 * Exits 0 on pass, 1 on any assertion failure.
 */
import fs from 'fs';
import path from 'path';
import { parseSearchPeopleHtml } from '../services/people-search.service';

const html = fs.readFileSync(
    path.join(__dirname, '../services/__fixtures__/people-search-sample.html'),
    'utf-8',
);

const people = parseSearchPeopleHtml(html, 10);
const fails: string[] = [];
const check = (cond: boolean, msg: string) => { if (!cond) fails.push(msg); };

check(people.length === 3, `expected 3 people, got ${people.length}`);

const [jane, sam, alex] = people;

check(jane?.name === 'Jane Doe', `jane.name = ${jane?.name}`);
check(jane?.firstName === 'Jane' && jane?.lastName === 'Doe', `jane name split = ${jane?.firstName}/${jane?.lastName}`);
check(jane?.connectionDegree === 2, `jane.degree = ${jane?.connectionDegree}`);
check(jane?.jobTitle === 'Head of Data', `jane.jobTitle = ${jane?.jobTitle}`);
check(jane?.company === 'Acme Analytics', `jane.company = ${jane?.company}`);
check(jane?.location === 'Berlin, Germany', `jane.location = ${jane?.location}`);
check(jane?.linkedinUrl === 'https://www.linkedin.com/in/jane-doe-123/', `jane.url = ${jane?.linkedinUrl}`);

// de-doubled "Sam Smith Sam Smith" → "Sam Smith"; "3rd+" → 3; no company.
check(sam?.name === 'Sam Smith', `sam.name = ${sam?.name}`);
check(sam?.connectionDegree === 3, `sam.degree = ${sam?.connectionDegree}`);
check(sam?.jobTitle === 'Analytics Student' && sam?.company === '', `sam job/company = ${sam?.jobTitle}/${sam?.company}`);

// "Alex Open is open to work" badge stripped; "@ Globex | ex-Initech" → company Globex.
check(alex?.name === 'Alex Open', `alex.name = ${alex?.name}`);
check(alex?.connectionDegree === 1, `alex.degree = ${alex?.connectionDegree}`);
check(alex?.company === 'Globex', `alex.company = ${alex?.company}`);

// No mutual-connection or insight person leaked in as a result.
const slugs = people.map((p) => p.linkedinUrl);
check(!slugs.some((u) => /friend-one|friend-two/.test(u)), `insight anchor leaked: ${slugs.join(', ')}`);

if (fails.length) {
    console.error(`❌ ${fails.length} assertion(s) failed:`);
    fails.forEach((f) => console.error('   • ' + f));
    console.error('\nParsed:', JSON.stringify(people, null, 2));
    process.exit(1);
}
console.log(`✅ parseSearchPeopleHtml: ${people.length} people, all assertions passed.`);
people.forEach((p) => console.log(`   • ${p.name} [${p.connectionDegree}] ${p.jobTitle}${p.company ? ' @ ' + p.company : ''} | ${p.location}`));
process.exit(0);
