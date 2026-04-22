const { chromium } = require('playwright');
(async () => {
  try {
    console.log('Attempting to launch chromium...');
    const browser = await chromium.launch({ headless: true });
    console.log('Successfully launched chromium!');
    console.log('Browser version:', browser.version());
    await browser.close();
  } catch (err) {
    console.error('Failed to launch chromium:', err);
  }
})();
