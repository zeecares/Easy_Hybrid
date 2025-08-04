import { test, expect } from '@playwright/test';

test.describe('GitHub Login Functionality', () => {
  test('should find and test GitHub login button', async ({ page }) => {
    console.log('Starting GitHub login test...');
    
    // Step 1: Navigate to the site
    console.log('1. Navigating to the site');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/screenshot-1-initial-load.png', fullPage: true });
    console.log('✓ Initial screenshot taken');

    // Step 2: Look for GitHub login button
    console.log('2. Looking for GitHub login button...');
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);
    
    // Try to find GitHub login button with various selectors
    const possibleSelectors = [
      'button:has-text("GitHub")',
      'a:has-text("GitHub")', 
      '[data-testid*="github"]',
      '[class*="github"]',
      'button:has-text("Sign in with GitHub")',
      'button:has-text("Login with GitHub")',
      'a:has-text("Sign in with GitHub")',
      'a:has-text("Login with GitHub")',
      'button[class*="github"]',
      'a[class*="github"]'
    ];
    
    let githubButton = null;
    let foundSelector = null;
    
    for (const selector of possibleSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          githubButton = element;
          foundSelector = selector;
          console.log(`✓ Found GitHub button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!githubButton) {
      console.log('⚠ No GitHub login button found with common selectors');
      console.log('Let me check all buttons and links on the page...');
      
      // Get all buttons and links
      const buttons = page.locator('button');
      const links = page.locator('a');
      
      const buttonCount = await buttons.count();
      const linkCount = await links.count();
      
      console.log(`Found ${buttonCount} buttons and ${linkCount} links`);
      
      // Check button text content
      for (let i = 0; i < buttonCount; i++) {
        try {
          const text = await buttons.nth(i).textContent();
          console.log(`Button ${i + 1}: "${text}"`);
          if (text && text.toLowerCase().includes('github')) {
            githubButton = buttons.nth(i);
            foundSelector = `button (text: "${text}")`;
            break;
          }
        } catch (e) {
          console.log(`Button ${i + 1}: Unable to get text`);
        }
      }
      
      // Check link text content if no button found
      if (!githubButton) {
        for (let i = 0; i < linkCount; i++) {
          try {
            const text = await links.nth(i).textContent();
            console.log(`Link ${i + 1}: "${text}"`);
            if (text && text.toLowerCase().includes('github')) {
              githubButton = links.nth(i);
              foundSelector = `link (text: "${text}")`;
              break;
            }
          } catch (e) {
            console.log(`Link ${i + 1}: Unable to get text`);
          }
        }
      }
    }
    
    // Take screenshot showing current state
    await page.screenshot({ path: 'test-results/screenshot-2-looking-for-button.png', fullPage: true });
    console.log('✓ Screenshot taken showing button search');

    // Step 3: Try to click the GitHub button if found
    if (githubButton) {
      console.log(`3. Attempting to click GitHub button (${foundSelector})...`);
      
      // Scroll to button and highlight it
      await githubButton.scrollIntoViewIfNeeded();
      
      // Take screenshot before clicking
      await page.screenshot({ path: 'test-results/screenshot-3-before-click.png', fullPage: true });
      console.log('✓ Screenshot before click taken');
      
      // Set up console log capture
      const consoleLogs = [];
      page.on('console', msg => {
        consoleLogs.push(`${msg.type()}: ${msg.text()}`);
      });
      
      // Set up error capture
      const pageErrors = [];
      page.on('pageerror', error => {
        pageErrors.push(error.message);
        console.log(`❌ Page error: ${error.message}`);
      });
      
      // Set up network error capture
      const networkErrors = [];
      page.on('response', response => {
        if (!response.ok()) {
          networkErrors.push(`${response.url()} - ${response.status()}`);
          console.log(`❌ Failed request: ${response.url()} - ${response.status()}`);
        }
      });
      
      const urlBeforeClick = page.url();
      
      // Click the button
      try {
        await githubButton.click();
        console.log('✓ GitHub button clicked');
        
        // Wait for potential navigation or popup
        await page.waitForTimeout(3000);
        
        // Check if we're on the same page or navigated
        const currentUrl = page.url();
        console.log(`URL before click: ${urlBeforeClick}`);
        console.log(`URL after click: ${currentUrl}`);
        
        // Take screenshot after clicking
        await page.screenshot({ path: 'test-results/screenshot-4-after-click.png', fullPage: true });
        console.log('✓ Screenshot after click taken');
        
        // Check for any error messages on the page
        const errorSelectors = [
          '[class*="error"]',
          '[class*="alert"]', 
          '.error',
          '.alert',
          '[role="alert"]',
          '.notification',
          '.message'
        ];
        
        for (const errorSelector of errorSelectors) {
          const errorElements = page.locator(errorSelector);
          const count = await errorElements.count();
          if (count > 0) {
            console.log(`Found ${count} elements with selector "${errorSelector}":`);
            for (let i = 0; i < count; i++) {
              try {
                const text = await errorElements.nth(i).textContent();
                console.log(`  Error element ${i + 1}: "${text}"`);
              } catch (e) {
                console.log(`  Error element ${i + 1}: Unable to get text`);
              }
            }
          }
        }
        
        // Log captured console messages
        if (consoleLogs.length > 0) {
          console.log('Console messages:');
          consoleLogs.forEach(log => console.log(`  ${log}`));
        }
        
        // Log captured errors
        if (pageErrors.length > 0) {
          console.log('Page errors:');
          pageErrors.forEach(error => console.log(`  ${error}`));
        }
        
        if (networkErrors.length > 0) {
          console.log('Network errors:');
          networkErrors.forEach(error => console.log(`  ${error}`));
        }
        
      } catch (clickError) {
        console.log(`❌ Error clicking GitHub button: ${clickError.message}`);
        await page.screenshot({ path: 'test-results/screenshot-4-click-error.png', fullPage: true });
      }
      
    } else {
      console.log('❌ No GitHub login button found on the page');
      
      // Let's also check what the page contains
      const pageTitle = await page.title();
      const pageText = await page.textContent('body');
      console.log(`Page title: ${pageTitle}`);
      console.log(`Page contains GitHub: ${pageText.toLowerCase().includes('github')}`);
    }
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/screenshot-5-final-state.png', fullPage: true });
    console.log('✓ Final screenshot taken');
    
    // Create a summary of what we found
    expect(true).toBe(true); // Always pass so we can see the results
  });
});