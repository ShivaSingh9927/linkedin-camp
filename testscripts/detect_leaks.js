const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'detection_results');

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: undefined,
  });

  const results = {};

  // ── Helper: inject detection checks on a blank page ──
  async function runCustomChecks(page, label) {
    const data = await page.evaluate(() => {
      const checks = {};

      // navigator.webdriver
      checks['navigator.webdriver'] = navigator.webdriver;

      // plugins
      checks['navigator.plugins.length'] = navigator.plugins.length;

      // chrome.runtime
      checks['chrome.runtime exists'] = !!(window.chrome && window.chrome.runtime);

      // cdc_ properties
      const cdcProps = Object.keys(document).filter(k => k.startsWith('cdc_'));
      checks['cdc_* properties'] = cdcProps.length > 0 ? cdcProps : 'none';

      // CDP detection via stack trace
      let cdpDetected = false;
      try {
        const e = new Error();
        Object.defineProperty(e, 'stack', { value: '' });
        throw e;
      } catch (err) {
        if (err.stack && err.stack.includes('puppeteer') || err.stack && err.stack.includes('cdp')) {
          cdpDetected = true;
        }
      }
      checks['CDP stack trace leak'] = cdpDetected;

      // sec-ch-ua
      checks['sec-ch-ua headers available'] = !!navigator.userAgentData;

      // window.navigator properties
      checks['navigator.languages'] = navigator.languages;
      checks['navigator.platform'] = navigator.platform;
      checks['navigator.hardwareConcurrency'] = navigator.hardwareConcurrency;

      // Permissions
      checks['permissions query'] = 'check required';

      return checks;
    });
    return data;
  }

  // ── 1. bot.sannysoft.com ──
  console.log('\n========== bot.sannysoft.com ==========');
  try {
    const page1 = await context.newPage();
    await page1.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await page1.waitForTimeout(3000);

    const sanny = await page1.evaluate(() => {
      const res = {};
      res['navigator.webdriver'] = navigator.webdriver;

      // Extract visible test result text from page
      const rows = document.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const name = cells[0]?.textContent?.trim();
          const value = cells[1]?.textContent?.trim();
          if (name && value) res[name] = value;
        }
      });
      return res;
    });

    console.log(JSON.stringify(sanny, null, 2));
    results['bot.sannysoft.com'] = sanny;

    await page1.screenshot({ path: path.join(OUTPUT_DIR, 'sannysoft.png'), fullPage: true });
    await page1.close();
  } catch (e) {
    console.error('sannysoft error:', e.message);
    results['bot.sannysoft.com'] = { error: e.message };
  }

  // ── 2. arh.antoinevastel.com/bots/areyouheadless ──
  console.log('\n========== areyouheadless ==========');
  try {
    const page2 = await context.newPage();
    await page2.goto('https://arh.antoinevastel.com/bots/areyouheadless', { waitUntil: 'networkidle', timeout: 30000 });
    await page2.waitForTimeout(5000);

    const headless = await page2.evaluate(() => {
      const res = {};
      res['navigator.webdriver'] = navigator.webdriver;
      const bodyText = document.body?.innerText || '';
      res['page text excerpt'] = bodyText.substring(0, 2000);
      return res;
    });

    console.log(JSON.stringify(headless, null, 2));
    results['areyouheadless'] = headless;

    await page2.screenshot({ path: path.join(OUTPUT_DIR, 'areyouheadless.png'), fullPage: true });
    await page2.close();
  } catch (e) {
    console.error('areyouheadless error:', e.message);
    results['areyouheadless'] = { error: e.message };
  }

  // ── 3. nowsecure.nl ──
  console.log('\n========== nowsecure.nl ==========');
  try {
    const page3 = await context.newPage();
    await page3.goto('https://nowsecure.nl/', { waitUntil: 'networkidle', timeout: 60000 });
    await page3.waitForTimeout(5000);

    const nowsecure = await page3.evaluate(() => {
      const res = {};
      res['navigator.webdriver'] = navigator.webdriver;
      const bodyText = document.body?.innerText || '';
      res['page text excerpt'] = bodyText.substring(0, 2000);
      res['title'] = document.title;
      res['url'] = window.location.href;
      return res;
    });

    console.log(JSON.stringify(nowsecure, null, 2));
    results['nowsecure.nl'] = nowsecure;

    await page3.screenshot({ path: path.join(OUTPUT_DIR, 'nowsecure.png'), fullPage: true });
    await page3.close();
  } catch (e) {
    console.error('nowsecure error:', e.message);
    results['nowsecure.nl'] = { error: e.message };
  }

  // ── 4. Injected minimal page with all checks ──
  console.log('\n========== Custom Injected Checks ==========');
  try {
    const page4 = await context.newPage();
    await page4.setContent('<html><head><title>Detection Check</title></head><body>Loading...</body></html>');
    await page4.waitForTimeout(1000);

    const custom = await runCustomChecks(page4, 'custom');
    console.log(JSON.stringify(custom, null, 2));
    results['custom_checks'] = custom;

    // Additional: check User-Agent Client Hints via request interception
    const uaHints = await page4.evaluate(async () => {
      const res = {};
      if (navigator.userAgentData) {
        res['brands'] = navigator.userAgentData.brands;
        res['mobile'] = navigator.userAgentData.mobile;
        res['platform'] = navigator.userAgentData.platform;
        try {
          const high = await navigator.userAgentData.getHighEntropyValues([
            'architecture', 'bitness', 'model', 'platformVersion',
            'fullVersionList', 'uaFullVersion'
          ]);
          res['highEntropy'] = high;
        } catch (e) {
          res['highEntropy error'] = e.message;
        }
      } else {
        res['userAgentData'] = 'not available';
      }
      return res;
    });
    console.log('\n--- User-Agent Client Hints ---');
    console.log(JSON.stringify(uaHints, null, 2));
    results['ua_client_hints'] = uaHints;

    await page4.screenshot({ path: path.join(OUTPUT_DIR, 'custom_checks.png'), fullPage: true });
    await page4.close();
  } catch (e) {
    console.error('custom checks error:', e.message);
    results['custom_checks'] = { error: e.message };
  }

  // ── 5. Additional: CDP detection via protocol ──
  console.log('\n========== CDP Runtime Check ==========');
  try {
    const page5 = await context.newPage();
    await page5.setContent('<html><body>CDP Check</body></html>');
    await page5.waitForTimeout(500);

    const cdpCheck = await page5.evaluate(() => {
      const res = {};

      // Check for __webdriver_* or __selenium_* globals
      const globals = Object.keys(window).filter(k =>
        k.startsWith('__webdriver') || k.startsWith('__selenium') ||
        k.startsWith('__fxdriver') || k.startsWith('_phantom') ||
        k.startsWith('__nightmare') || k.startsWith('callPhantom')
      );
      res['automation globals'] = globals.length > 0 ? globals : 'none';

      // Check for toString override
      const fn = function toString() {};
      const oldStr = Function.prototype.toString;
      try {
        Function.prototype.toString = function() {
          if (this === fn) return 'function toString() { [native code] }';
          return oldStr.call(this);
        };
        res['toString override'] = 'tested';
      } catch (e) {
        res['toString override error'] = e.message;
      }
      Function.prototype.toString = oldStr;

      // Canvas fingerprint noise check
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('test', 0, 0);
      const dataUrl = canvas.toDataURL();
      res['canvas fingerprint'] = dataUrl.substring(0, 100) + '...';

      // WebGL vendor/renderer
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        res['webgl vendor'] = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        res['webgl renderer'] = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      } catch (e) {
        res['webgl error'] = e.message;
      }

      return res;
    });

    console.log(JSON.stringify(cdpCheck, null, 2));
    results['cdp_runtime_check'] = cdpCheck;

    await page5.close();
  } catch (e) {
    console.error('cdp check error:', e.message);
    results['cdp_runtime_check'] = { error: e.message };
  }

  // ── Save all results ──
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'full_results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`\nAll results saved to ${OUTPUT_DIR}/full_results.json`);

  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
