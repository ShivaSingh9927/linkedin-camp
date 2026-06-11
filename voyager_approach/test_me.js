/**
 * Test 1: GET /voyager/api/me
 * Simplest endpoint — verify cookies, CSRF, and headers all work.
 */
const { voyagerGet, logResult } = require('./voyager-client');

(async () => {
    console.log('=== Test 1: GET /me ===\n');

    const result = await voyagerGet('/me');

    logResult('/me', result);

    if (result.status === 200 && result.data) {
        const d = result.data;
        const plainId = d.data?.plainId || d.plainId || 'N/A';
        const included = d.included || [];
        const mini = included.find(i => i.entityUrn?.includes('fs_miniProfile'));
        console.log('\n✅ SUCCESS — Voyager client works!');
        console.log('   Plain ID:', plainId);
        console.log('   First Name:', mini?.firstName || 'N/A');
        console.log('   Last Name:', mini?.lastName || 'N/A');
        console.log('   Headline:', mini?.headline || 'N/A');
    } else {
        console.log('\n❌ Failed — Check cookies, CSRF token, or headers.');
    }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
