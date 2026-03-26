const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const hetznerIp = '204.168.167.198';
    const token = 'Raja_Security_2026';
    const userId = 'shiva_test_001';

    // Connect to the Browserless WebSocket
    const wsUrl = `ws://${hetznerIp}:3000/chromium?token=${token}&--user-data-dir=/sessions/${userId}`;

    try {
        console.log(`🚀 CONNECTING TO HETZNER...`);
        const browser = await chromium.connectOverCDP(wsUrl);
        const context = browser.contexts()[0];
        const page = await context.newPage();

        console.log(`Navigating to LinkedIn Login...`);
        await page.goto('https://www.linkedin.com/login');

        console.log(`\n✅ CLOUD BROWSER IS READY!`);
        console.log(`⌛ Waiting for you to log in via the HTML file...`);

        // Check for the 'li_at' cookie every 2 seconds
        const checkInterval = setInterval(async () => {
            try {
                const cookies = await context.cookies();
                const liAt = cookies.find(c => c.name === 'li_at');
                if (liAt) {
                    console.log('\n🔥 LOGIN DETECTED!');
                    fs.writeFileSync(`session_${userId}.json`, JSON.stringify(cookies, null, 2));
                    console.log(`🟢 Session saved to session_${userId}.json`);
                    clearInterval(checkInterval);
                    process.exit(0);
                }
            } catch (e) { /* ignore errors during check */ }
        }, 2000);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();