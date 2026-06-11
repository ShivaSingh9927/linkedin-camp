/**
 * Test 6: Connect — Using Waalaxy's voagerRelationshipsDashMemberRelationships endpoint.
 * WARNING: Sends a REAL connection request!
 */
const { voyagerPost, voyagerGet, logResult } = require('./voyager-client');

(async () => {
    console.log('=== Test 6: Send Connection Request (Waalaxy endpoint) ===\n');
    console.log('  ⚠ WARNING: This sends a REAL LinkedIn connection request!\n');

    // Get a target from search suggestions or use our known target
    const targetUrn = 'urn:li:fsd_profile:ACoAAA4YxX4BmTE4ufg10_NRM12nkPRxP-ajNck';
    
    // First try to check if already connected
    console.log('  Checking connection status...');
    
    // Try Waalaxy's connect endpoint with decoration ID
    console.log('  Using Waalaxy endpoint: verifyQuotaAndCreateV2');
    const connectPayload = {
        inviteeProfileUrn: targetUrn,
        trackingId: 'voyager-test-' + Date.now(),
    };

    let result = await voyagerPost(
        '/voyagerRelationshipsDashMemberRelationships',
        connectPayload,
        {
            action: 'verifyQuotaAndCreateV2',
            decorationId: 'com.linkedin.voyager.dash.deco.relationships.InvitationCreationResultWithInvitee-2',
        }
    );
    logResult('Connect V2', result);

    // Fallback: try growth/normInvitations
    if (result.status >= 400) {
        console.log('\n  Falling back to /growth/normInvitations...');
        const normPayload = {
            emberEntityName: 'growth/invitation/norm-invitation',
            invitee: {
                'com.linkedin.voyager.growth.invitation.InviteeProfile': {
                    profileId: targetUrn,
                },
            },
            trackingId: 'voyager-test-' + Date.now(),
        };
        result = await voyagerPost('/growth/normInvitations', normPayload, {});
        logResult('Norm Invite', result);
    }

    if (result.status >= 400) {
        // Try batch create
        console.log('\n  Falling back to /growth/normInvitations?action=batchCreate...');
        const batchPayload = {
            invitations: [{
                emberEntityName: 'growth/invitation/norm-invitation',
                invitee: {
                    'com.linkedin.voyager.growth.invitation.InviteeProfile': {
                        profileId: targetUrn,
                    },
                },
            }],
        };
        result = await voyagerPost(
            '/growth/normInvitations',
            batchPayload,
            { action: 'batchCreate' }
        );
        logResult('Batch Create', result);
    }

    if (result.status === 200 || result.status === 201) {
        console.log('\n✅ Connection request sent!');
    } else if (result.status === 400 || result.status === 422) {
        const msg = result.data?.message || result.data?.error || JSON.stringify(result.data);
        console.log('\n⚠ Request blocked (likely already connected/invited/limit reached)');
        console.log('  ', msg.substring(0, 200));
    } else {
        console.log('\n❌ Connection failed');
    }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
