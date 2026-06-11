/**
 * Test 4: Conversations — Try Waalaxy's messaging endpoints.
 */
const { voyagerGet, logResult } = require('./voyager-client');

(async () => {
    console.log('=== Test 4: Messaging Endpoints ===\n');

    // Pattern 1: connections summary (read-only, low risk)
    console.log('--- Connections Summary ---');
    let result = await voyagerGet('/relationships/connectionsSummary', {});
    logResult('Connections Summary', result);
    if (result.status === 200) {
        const data = result.data;
        console.log('  Connections:', data?.paging?.total || data?.data?.paging?.total || 'N/A');
    }

    // Pattern 2: sent invitations (read-only)
    console.log('\n--- Sent Invites ---');
    result = await voyagerGet('/voyagerRelationshipsDashGenericInvitationFacets', { q: 'sent' });
    logResult('Sent Invites', result);

    // Pattern 3: recipients suggestions
    console.log('\n--- Recipient Suggestions ---');
    result = await voyagerGet('/voyagerMessagingPeripheralRecipientSuggestions', {});
    logResult('Recipient Suggestions', result);

    console.log('\n=== Done ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
