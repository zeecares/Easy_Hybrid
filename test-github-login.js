import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('Starting GitHub login test...');
  
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    // Step 1: Navigate to the site
    console.log('1. Navigating to https://easy-hybrid.pages.dev/');
    await page.goto('https://easy-hybrid.pages.dev/');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshot-1-initial-load.png', fullPage: true });
    console.log('✓ Initial screenshot taken: screenshot-1-initial-load.png');

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
      'a:has-text("Login with GitHub")'
    ];
    
    let githubButton = null;
    let foundSelector = null;
    
    for (const selector of possibleSelectors) {
      try {
        const element = await page.locator(selector).first();
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
      const buttons = await page.locator('button').all();
      const links = await page.locator('a').all();
      
      console.log(`Found ${buttons.length} buttons and ${links.length} links`);
      
      // Check button text content
      for (let i = 0; i < buttons.length; i++) {
        try {
          const text = await buttons[i].textContent();
          console.log(`Button ${i + 1}: "${text}"`);
          if (text && text.toLowerCase().includes('github')) {
            githubButton = buttons[i];
            foundSelector = `button (text: "${text}")`;
            break;
          }
        } catch (e) {
          console.log(`Button ${i + 1}: Unable to get text`);
        }
      }
      
      // Check link text content
      for (let i = 0; i < links.length; i++) {
        try {
          const text = await links[i].textContent();
          console.log(`Link ${i + 1}: "${text}"`);
          if (text && text.toLowerCase().includes('github')) {
            githubButton = links[i];
            foundSelector = `link (text: "${text}")`;
            break;
          }
        } catch (e) {
          console.log(`Link ${i + 1}: Unable to get text`);
        }
      }
    }
    
    // Take screenshot showing current state
    await page.screenshot({ path: 'screenshot-2-looking-for-button.png', fullPage: true });
    console.log('✓ Screenshot taken: screenshot-2-looking-for-button.png');

    // Step 3: Try to click the GitHub button if found
    if (githubButton) {
      console.log(`3. Attempting to click GitHub button (${foundSelector})...`);
      
      // Scroll to button and highlight it
      await githubButton.scrollIntoViewIfNeeded();
      await githubButton.highlight();
      
      // Take screenshot before clicking
      await page.screenshot({ path: 'screenshot-3-before-click.png', fullPage: true });
      console.log('✓ Screenshot before click: screenshot-3-before-click.png');
      
      // Set up event listeners for navigation and errors
      let navigationPromise = null;
      let errorOccurred = false;
      let errorMessage = '';
      
      page.on('pageerror', (error) => {
        errorOccurred = true;
        errorMessage = error.message;
        console.log(`❌ Page error: ${error.message}`);
      });
      
      page.on('response', (response) => {
        if (!response.ok()) {
          console.log(`❌ Failed request: ${response.url()} - ${response.status()}`);
        }
      });
      
      // Click the button
      try {
        await githubButton.click();
        console.log('✓ GitHub button clicked');
        
        // Wait for potential navigation or popup
        await page.waitForTimeout(3000);
        
        // Check if we're on the same page or navigated
        const currentUrl = page.url();
        console.log(`Current URL after click: ${currentUrl}`);
        
        // Take screenshot after clicking
        await page.screenshot({ path: 'screenshot-4-after-click.png', fullPage: true });
        console.log('✓ Screenshot after click: screenshot-4-after-click.png');
        
        // Check for any error messages on the page
        const errorElements = await page.locator('[class*="error"], [class*="alert"], .error, .alert').all();
        if (errorElements.length > 0) {
          console.log(`Found ${errorElements.length} potential error elements:`);
          for (let i = 0; i < errorElements.length; i++) {
            try {
              const text = await errorElements[i].textContent();
              console.log(`Error element ${i + 1}: "${text}"`);
            } catch (e) {
              console.log(`Error element ${i + 1}: Unable to get text`);
            }
          }
        }
        
        // Check console for errors
        const logs = [];
        page.on('console', (msg) => {
          logs.push(`${msg.type()}: ${msg.text()}`);
        });
        
        await page.waitForTimeout(2000);
        
        if (logs.length > 0) {
          console.log('Console messages:');
          logs.forEach(log => console.log(`  ${log}`));
        }
        
      } catch (clickError) {
        console.log(`❌ Error clicking GitHub button: ${clickError.message}`);
        await page.screenshot({ path: 'screenshot-4-click-error.png', fullPage: true });
      }
      
    } else {
      console.log('❌ No GitHub login button found on the page');
    }
    
    // Final screenshot
    await page.screenshot({ path: 'screenshot-5-final-state.png', fullPage: true });
    console.log('✓ Final screenshot: screenshot-5-final-state.png');
    
  } catch (error) {
    console.log(`❌ Test error: ${error.message}`);
    await page.screenshot({ path: 'screenshot-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
  
  console.log('GitHub login test completed!');
})();