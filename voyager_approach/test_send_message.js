/**
 * Test 5: Send Message — Debug various endpoint/format combinations.
 */
const { voyagerGet, voyagerPost, logResult } = require('./voyager-client');

(async () => {
    console.log('=== Test 5: Message — Debug Endpoints ===\n');

    const recipientFsdUrn = 'urn:li:fsd_profile:ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0';
    const recipientMemberUrn = 'urn:li:member:660119273';
    const msgBody = 'Test ' + Date.now();

    // Test 1: Waalaxy endpoint with accept: application/json
    console.log('--- Test 1: Waalaxy createMessage (accept: application/json) ---');
    let r = await voyagerPost(
        '/voyagerMessagingDashMessengerMessages',
        {
            message: {
                body: { text: msgBody, attributes: [] },
                renderContentUnions: [],
                originToken: 'test-' + Date.now(),
            },
            hostRecipientUrns: [recipientFsdUrn],
        },
        { action: 'createMessage' },
        {
            accept: 'application/json',
            'x-restli-protocol-version': '2.0.0',
        }
    );
    logResult('Waalaxy json', r);

    // Test 2: Waalaxy endpoint with member URN
    console.log('\n--- Test 2: Waalaxy createMessage (member URN) ---');
    r = await voyagerPost(
        '/voyagerMessagingDashMessengerMessages',
        {
            message: {
                body: { text: msgBody, attributes: [] },
                renderContentUnions: [],
                originToken: 'test-' + Date.now(),
            },
            hostRecipientUrns: [recipientMemberUrn],
        },
        { action: 'createMessage' },
        {
            accept: 'application/json',
            'x-restli-protocol-version': '2.0.0',
        }
    );
    logResult('Waalaxy member', r);

    // Test 3: Legacy endpoint with fsd_profile URN
    console.log('\n--- Test 3: Legacy create conversation (fsd_profile) ---');
    r = await voyagerPost(
        '/messaging/conversations',
        {
            keyVersion: 'LEGACY_INBOX',
            conversationCreate: {
                recipients: [recipientFsdUrn],
                subtype: 'MEMBER_TO_MEMBER',
                eventCreate: {
                    value: {
                        'com.linkedin.voyager.messaging.create.MessageCreate': {
                            body: msgBody,
                            attachments: [],
                            attributedBody: { text: msgBody, attributes: [] },
                            mediaAttachments: [],
                        },
                    },
                },
            },
        },
        { action: 'create' }
    );
    logResult('Legacy fsd', r);

    // Test 4: Accept both formats (no accept header override)
    console.log('\n--- Test 4: Legacy (default accept header) ---');
    r = await voyagerPost(
        '/messaging/conversations',
        {
            keyVersion: 'LEGACY_INBOX',
            conversationCreate: {
                recipients: [recipientFsdUrn],
                subtype: 'MEMBER_TO_MEMBER',
                eventCreate: {
                    value: {
                        'com.linkedin.voyager.messaging.create.MessageCreate': {
                            body: msgBody,
                            attachments: [],
                            attributedBody: { text: msgBody, attributes: [] },
                            mediaAttachments: [],
                        },
                    },
                },
            },
        },
        { action: 'create' }
    );
    logResult('Legacy default', r);

    // Test 5: Try the REST-li format (matching Waalaxy's internal format)
    console.log('\n--- Test 5: Try /voyagerMessagingDashMessengerConversations ---');
    r = await voyagerPost(
        '/voyagerMessagingDashMessengerConversations',
        {
            recipients: [recipientFsdUrn],
            message: {
                body: { text: msgBody, attributes: [] },
                renderContentUnions: [],
                originToken: 'test-' + Date.now(),
            },
        },
        { action: 'create' },
        {
            accept: 'application/json',
            'x-restli-protocol-version': '2.0.0',
        }
    );
    logResult('Conv create', r);

    console.log('\n=== All tests complete ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
