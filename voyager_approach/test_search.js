/**
 * Test 3: Search — Fixed with correct params.
 */
const { voyagerGet, logResult } = require('./voyager-client');

(async () => {
    console.log('=== Test 3: Search People ===\n');

    // Pattern from Waalaxy source: search/cluster with query parameter
    const params = {
        count: '10',
        origin: 'SWITCH_SEARCH_VERTICAL',
        q: 'guided',
        guides: 'List(v->PEOPLE)',
        keywords: 'software engineer',
        start: '0',
    };
    console.log('--- /search/hits (guided) ---');
    let result = await voyagerGet('/search/hits', params);
    logResult('Search Hits', result);

    if (result.status !== 200) {
        // Try with different q param
        console.log('\n--- /search/cluster (q=all) ---');
        result = await voyagerGet('/search/cluster', {
            q: 'all',
            query: '(keywords:software engineer,flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE)),includeFiltersInResponse:false)',
            start: '0',
            count: '10',
            origin: 'SWITCH_SEARCH_VERTICAL',
        });
        logResult('Search Cluster', result);
    }

    if (result.status === 200) {
        const data = result.data?.data || result.data;
        const elements = data?.elements || data?.['*elements'] || data || [];
        console.log(`  Results:`, typeof elements === 'object' ? JSON.stringify(elements).substring(0, 300) : elements);
    }

    console.log('\n' + (result.status === 200 ? '✅ Search works!' : '❌ Search failed'));
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
