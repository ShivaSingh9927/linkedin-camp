/**
 * Test 2: Profile — Using Waalaxy's /identity/profiles/{publicId}/highlights
 * and also try the identity-dash-profiles endpoint
 */
const { voyagerGet, logResult } = require('./voyager-client');

async function tryEndpoint(path, params, label) {
    console.log(`\n--- ${label} ---`);
    const result = await voyagerGet(path, params);
    logResult(label, result);
    if (result.status === 200) {
        console.log('   ✅ WORKS');
        return true;
    }
    return false;
}

(async () => {
    console.log('=== Test 2: Profile Endpoints ===');

    // Our public identifier from /me response
    // The miniProfile URN is urn:li:fs_miniProfile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRl0
    const ourEncryptedId = 'ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRl0';
    const ourPlainId = '1761142362';
    const targetSlug = 'shiva-singh-1672093604';

    // 1. Waalaxy's highlights endpoint
    await tryEndpoint(
        `/identity/profiles/${ourEncryptedId}/highlights`,
        {},
        'Highlights (own, encrypted ID)'
    );

    // 2. Try highlights with plain ID
    await tryEndpoint(
        `/identity/profiles/${ourPlainId}/highlights`,
        {},
        'Highlights (own, plain ID)'
    );

    // 3. Try the full identity dash profiles endpoint
    await tryEndpoint(
        '/identity/dash/profiles',
        {
            q: 'memberIdentity',
            memberIdentity: ourPlainId,
            decorationId: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
        },
        'Dash Profiles (own, plainId)'
    );

    // 4. Try with encrypted ID
    await tryEndpoint(
        '/identity/dash/profiles',
        {
            q: 'memberIdentity',
            memberIdentity: ourEncryptedId,
            decorationId: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
        },
        'Dash Profiles (own, encryptedId)'
    );

    // 5. Try the profile view from Waalaxy's identity module
    await tryEndpoint(
        '/feed/identityModule',
        {
            decorationId: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
            q: 'memberIdentity',
            memberIdentity: ourPlainId,
        },
        'Identity Module (own)'
    );

    console.log('\n=== Done ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
