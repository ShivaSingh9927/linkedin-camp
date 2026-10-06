// Does every inbox thread resolve to the right lead?
//
// Read-only. Pulls the live thread list and runs the matcher the worker uses,
// reporting which threads find a lead and which do not. Writes nothing and
// sends nothing.
//
// ENV: QUSER_ID

import { prisma } from '@repo/db';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { buildLeadIndex, matchLead } from '../workers/inbox.worker';

async function main() {
    const userId = process.env.QUSER_ID!;
    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }

    // Read the threads through the HTTP route rather than calling syncInbox
    // directly: the mailbox urn is per-process cache state that only
    // warmSelfCache fills, and that route now warms itself. Browser-free
    // priming does not work here — getMe needs a live page for its headers.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    const token = jwt.sign({ id: user!.id, email: user!.email }, process.env.JWT_SECRET!, { expiresIn: '10m' });
    const { data } = await axios.get('http://localhost:3001/api/v1/voyager/inbox?maxThreads=40', {
        headers: { Authorization: `Bearer ${token}` }, timeout: 120000,
    });
    const threads = data?.data?.conversations || [];

    const index = await buildLeadIndex(userId);
    console.log(`threads: ${threads.length}   leads indexed: ${index.byName.size} names / ${index.byVanity.size} vanities\n`);

    let matched = 0, missed = 0;
    for (const c of threads) {
        const who = `${c.otherFirstName} ${c.otherLastName || ''}`.trim();
        const lead = matchLead(index, c);
        const slug = String(c.otherProfileUrl || '').split('/in/')[1] || '';
        const obfuscated = /^ACoAA/i.test(slug);
        if (lead) {
            matched++;
            const leadName = `${lead.firstName} ${lead.lastName || ''}`.trim();
            const samePlace = `${c.otherFirstName}|${c.otherLastName}` === `${lead.firstName}|${lead.lastName}`;
            console.log(`  OK   ${who.padEnd(24)} -> ${leadName.padEnd(24)} ${obfuscated ? 'obfuscated-url' : 'vanity-url'}${samePlace ? '' : '  SPLIT DIFFERS'}`);
        } else {
            missed++;
            console.log(`  --   ${who.padEnd(24)} -> no lead saved        ${obfuscated ? 'obfuscated-url' : 'vanity-url'}`);
        }
    }
    console.log(`\nmatched ${matched}, unmatched ${missed}`);
    console.log('(unmatched is expected for people who were never saved as leads)');

    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e?.message || e); await prisma.$disconnect(); process.exit(1); });
