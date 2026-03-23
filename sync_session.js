/**
 * LINKEDIN SYNC HELPER
 * Run this on your local laptop to sync your LinkedIn session to the cloud.
 * 
 * Instructions:
 * 1. Ensure you have Node.js installed.
 * 2. Run: npm install playwright-extra puppeteer-extra-plugin-stealth adm-zip axios form-data
 * 3. Run: node sync_session.js
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const AdmZip = require('adm-zip');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

// --- CONFIGURATION ---
const API_URL = 'http://204.168.167.198:3001'; // Your Hetzner Server URL
const USER_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Get this from your browser's localStorage or request it

async function sync() {
    console.log('🚀 Starting Local LinkedIn Sync...');
    
    const sessionPath = path.join(process.cwd(), 'local_linkedin_session');
    
    const context = await chromium.launchPersistentContext(sessionPath, {
        headless: false, // We need to see it to login
        viewport: { width: 1280, height: 720 },
        args: ['--disable-blink-features=AutomationControlled']
    });

    const page = context.pages()[0] || await context.newPage();
    console.log('📍 Navigating to LinkedIn... Please log in.');
    
    await page.goto('https://www.linkedin.com/login');

    // Wait for successful login (URL change to feed)
    try {
        await page.waitForURL('**/feed/**', { timeout: 300000 }); // 5 minute timeout
        console.log('✅ Login detected!');
    } catch (e) {
        console.log('❌ Timeout waiting for login. Please try again.');
        await context.close();
        return;
    }

    console.log('⏳ Finalizing session data (5s)...');
    await page.waitForTimeout(5000);
    
    console.log('🤐 Zipping session files...');
    await context.close();

    const zip = new AdmZip();
    zip.addLocalFolder(sessionPath);
    const zipBuffer = zip.toBuffer();

    console.log(`📤 Uploading session to cloud (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);

    const form = new FormData();
    form.append('sessionZip', zipBuffer, {
        filename: 'session.zip',
        contentType: 'application/zip',
    });

    try {
        const response = await axios.post(`${API_URL}/auth/upload-session`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${USER_TOKEN}`
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (response.data.success) {
            console.log('🎉 SUCCESS! Your session is now synced to the cloud.');
            console.log('🚀 You can now close this script and your campaigns will run on the server.');
        } else {
            console.log('❌ Server Error:', response.data.error);
        }
    } catch (err) {
        console.error('❌ Upload Failed:', err.response?.data?.error || err.message);
    }

    // Optional: Cleanup local folder
    // fs.rmSync(sessionPath, { recursive: true, force: true });
}

if (USER_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    console.log('‼️ ERROR: Please edit sync_session.js and paste your AUTH_TOKEN at the top.');
    process.exit(1);
}

sync();
