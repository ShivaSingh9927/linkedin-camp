import { test, expect } from '@playwright/test';

test('Workflow Builder - Message Settings Panel should be visible and editable', async ({ page }) => {
    // 1. Navigate to the builder (assuming a campaign exists)
    // For this e2e test to work, we need a valid campaign ID. 
    // We'll skip realistic DB setup and just check the UI logic in the next steps.
    
    await page.goto('/campaigns/test-campaign/builder');

    // 2. Add a Message Node
    await page.click('button:has-text("Send Message")');
    
    // 3. Select the Node to open Settings
    const messageNode = page.locator('div:has-text("Send Message")').last();
    await messageNode.click();

    // 4. Verify Settings Panel Title
    await expect(page.locator('h3:has-text("Step Settings")')).toBeVisible();
    await expect(page.locator('p:has-text("Send Message")')).toBeVisible();

    // 5. Verify Textarea exists (The 'cannot type' fix)
    const textarea = page.locator('textarea[placeholder*="Type your message here"]');
    await expect(textarea).toBeVisible();

    // 6. Type a custom message
    const customMsg = "Hello {firstName}, I love your work! Let's connect.";
    await textarea.fill(customMsg);
    await expect(textarea).toHaveValue(customMsg);

    // 7. Click Close
    await page.click('button:has-text("Close Settings")');
    await expect(page.locator('h3:has-text("Step Settings")')).not.toBeVisible();

    console.log("✅ UI Integration Test Passed: Settings panel is functional.");
});
