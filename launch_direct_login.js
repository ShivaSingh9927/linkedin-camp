// launch_direct_login.js
/**
 * Browserless v2 'Direct Mode' Launcher
 * This script generates a direct persistent login URL without the Code UI.
 */

async function launch() {
  const hetznerIp = '204.168.167.198';
  const token = 'Raja_Security_2026';
  const userId = 'shiva_test_001'; // Data path on server

  console.log("🚀 Launching LinkedIn session on Browserless v2...");

  // In v2, simply opening the root with '?launch=' gives you a clean browser.
  const launchOptions = {
    args: [
      "--no-sandbox",
      `--user-data-dir=/sessions/${userId}`,
      "--disable-blink-features=AutomationControlled"
    ],
    // Navigate straight to LinkedIn login page
    baseURL: 'https://www.linkedin.com/login'
  };

  const params = new URLSearchParams({
    token: token,
    launch: JSON.stringify(launchOptions)
  });

  const directUrl = `http://${hetznerIp}:3000/?${params.toString()}`;

  console.log("\n✅ CLEAN BROWSER READY!");
  console.log("------------------------------------------------------------------");
  console.log(`🔗 OPEN THIS LINK IN CHROME:`);
  console.log(directUrl);
  console.log("------------------------------------------------------------------");
  console.log("\n1. Paste that link into your browser.");
  console.log("2. You'll see the browser screen. Log in to LinkedIn.");
  console.log("3. Once logged in, your session is saved in the cloud!");
  
  // Script ends, user opens URL
}

launch();

