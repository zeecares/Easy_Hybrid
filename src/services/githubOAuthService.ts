// GitHub OAuth Device Flow Service for Client-Side Authentication
// Zero data retention - all data stays in user's GitHub account

export interface GitHubOAuthConfig {
  clientId: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
}

export interface OAuthResult {
  success: boolean;
  accessToken?: string;
  user?: GitHubUser;
  error?: string;
}

export class GitHubOAuthService {
  private readonly CLIENT_ID = 'Iv1.b507a08443956f65'; // Public client ID for Easy Hybrid
  private readonly DEVICE_CODE_URL = 'https://github.com/login/device/code';
  private readonly ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
  private readonly USER_API_URL = 'https://api.github.com/user';
  
  private pollInterval?: NodeJS.Timeout;

  // Step 1: Request device and user codes
  async requestDeviceCodes(): Promise<{ success: boolean; config?: GitHubOAuthConfig; error?: string }> {
    try {
      const response = await fetch(this.DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.CLIENT_ID,
          scope: 'gist'
        }),
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      
      const config: GitHubOAuthConfig = {
        clientId: this.CLIENT_ID,
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresIn: data.expires_in,
        interval: data.interval,
      };

      return { success: true, config };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to request device codes' 
      };
    }
  }

  // Step 2: Poll for access token after user authorizes
  async pollForAccessToken(deviceCode: string, interval: number): Promise<OAuthResult> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max (120 * 5 seconds)

      this.pollInterval = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          this.stopPolling();
          resolve({ success: false, error: 'Authorization timeout - please try again' });
          return;
        }

        try {
          const response = await fetch(this.ACCESS_TOKEN_URL, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: this.CLIENT_ID,
              device_code: deviceCode,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
          });

          const data = await response.json();

          if (data.error) {
            if (data.error === 'authorization_pending') {
              // Continue polling
              return;
            } else if (data.error === 'slow_down') {
              // GitHub wants us to slow down - not implemented for simplicity
              return;
            } else {
              // Other errors (expired_token, access_denied, etc.)
              this.stopPolling();
              resolve({ success: false, error: `Authorization failed: ${data.error_description || data.error}` });
              return;
            }
          }

          if (data.access_token) {
            this.stopPolling();
            
            // Get user info
            const userResult = await this.getUserInfo(data.access_token);
            if (userResult.success && userResult.user) {
              resolve({ 
                success: true, 
                accessToken: data.access_token,
                user: userResult.user
              });
            } else {
              resolve({ success: false, error: 'Failed to get user information' });
            }
            return;
          }

        } catch (error) {
          // Continue polling on network errors
          console.warn('Polling error:', error);
        }
      }, interval * 1000);
    });
  }

  // Get user information
  private async getUserInfo(accessToken: string): Promise<{ success: boolean; user?: GitHubUser; error?: string }> {
    try {
      const response = await fetch(this.USER_API_URL, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const user = await response.json();
      return { success: true, user };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get user info' 
      };
    }
  }

  // Stop polling
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  // Complete OAuth flow
  async authenticateWithGitHub(): Promise<OAuthResult> {
    // Step 1: Get device codes
    const codesResult = await this.requestDeviceCodes();
    if (!codesResult.success || !codesResult.config) {
      return { success: false, error: codesResult.error };
    }

    const config = codesResult.config;

    // Open GitHub authorization in new tab
    window.open(config.verificationUri, '_blank');

    // Step 2: Poll for access token
    const tokenResult = await this.pollForAccessToken(config.deviceCode, config.interval);
    return tokenResult;
  }
}

// Export singleton instance
export const githubOAuthService = new GitHubOAuthService();
