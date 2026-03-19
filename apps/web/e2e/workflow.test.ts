import { test, expect } from '@playwright/test';

test('Workflow Builder - Message Node Textarea exists and is editable', async ({ page }) => {
    // 1. Navigate to leads page (assuming we're logged in/dev mode)
    await page.goto('/campaigns');

    // 2. Click 'Start a Campaign'
    await page.click('button:has-text("Start a Campaign")');

    // 3. Select 'LinkedIn' template
    await page.click('button:has-text("LinkedIn")');

    // 4. Fill campaign name and confirm
    await page.fill('input[placeholder="Enter campaign name..."]', 'Test Message Node');
    await page.click('button:has-text("Confirm Selection")');

    // 5. Wait for builder to load
    await expect(page).toHaveURL(/\/campaigns\/.*\/builder/);

    // 6. Click on the 'Send Message' node or 'Connect Request' node in the canvas
    // We target the node by text
    await page.click('div.react-flow__node-ACTION:has-text("Send Message")');

    // 7. Check if settings panel appears
    await expect(page.locator('h3:has-text("Step Settings")')).toBeVisible();

    // 8. Verify textarea exists for message
    const textarea = page.locator('textarea[placeholder="Type your message here..."]');
    await expect(textarea).toBeVisible();

    // 9. Type into textarea
    const testMessage = 'Hello {firstName}, this was typed by an automated test!';
    await textarea.fill(testMessage);

    // 10. Verify value was updated
    await expect(textarea).toHaveValue(testMessage);

    // 11. Optional: Close settings and reopen to see if it persisted in local state
    await page.click('button:has-text("Close Settings")');
    await page.click('div.react-flow__node-ACTION:has-text("Send Message")');
    await expect(textarea).toHaveValue(testMessage);
});
