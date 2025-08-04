// GitHub OAuth Redirect Flow Service for Client-Side Authentication
// Zero data retention - all data stays in user's GitHub account

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
  private readonly CLIENT_ID = 'Ov23liSICgtVvOFGijM9'; // Public client ID for Easy Hybrid (Web OAuth App)
  private readonly AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
  private readonly ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
  private readonly USER_API_URL = 'https://api.github.com/user';
  private readonly REDIRECT_URI = window.location.origin;
  private readonly SCOPE = 'gist';
  
  // Generate random state for security
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Step 1: Initiate OAuth redirect flow
  initiateOAuthFlow(): void {
    try {
      const state = this.generateState();
      localStorage.setItem('github_oauth_state', state);
      
      const params = new URLSearchParams({
        client_id: this.CLIENT_ID,
        redirect_uri: this.REDIRECT_URI,
        scope: this.SCOPE,
        state: state,
        allow_signup: 'true'
      });
      
      const authUrl = `${this.AUTHORIZE_URL}?${params.toString()}`;
      window.location.href = authUrl;
    } catch (error) {
      console.error('GitHub OAuth - Failed to initiate flow:', error);
      throw new Error('Failed to start GitHub authentication');
    }
  }

  // Step 2: Handle OAuth callback (extract code from URL)
  async handleOAuthCallback(): Promise<OAuthResult> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      // Check for error from GitHub
      if (error) {
        return {
          success: false,
          error: `GitHub authorization failed: ${error}`
        };
      }

      // Verify state parameter
      const storedState = localStorage.getItem('github_oauth_state');
      if (!state || state !== storedState) {
        return {
          success: false,
          error: 'Invalid state parameter - possible CSRF attack'
        };
      }

      if (!code) {
        return {
          success: false,
          error: 'No authorization code received from GitHub'
        };
      }

      // Exchange code for access token
      const tokenResult = await this.exchangeCodeForToken(code);
      if (!tokenResult.success) {
        return tokenResult;
      }

      // Get user info
      const userResult = await this.getUserInfo(tokenResult.accessToken!);
      if (!userResult.success) {
        return {
          success: false,
          error: userResult.error || 'Failed to get user information'
        };
      }

      // Clean up
      localStorage.removeItem('github_oauth_state');

      return {
        success: true,
        accessToken: tokenResult.accessToken,
        user: userResult.user
      };

    } catch (error) {
      console.error('GitHub OAuth - Callback handling failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth callback failed'
      };
    }
  }

  // Step 3: Exchange authorization code for access token using backend function
  private async exchangeCodeForToken(code: string): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    try {
      // Use our Cloudflare Pages function for secure token exchange
      const response = await fetch('/api/oauth/callback', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          client_id: this.CLIENT_ID,
          redirect_uri: this.REDIRECT_URI
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Token exchange failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        return {
          success: false,
          error: data.error
        };
      }

      if (!data.access_token) {
        return {
          success: false,
          error: 'No access token received from backend'
        };
      }

      return {
        success: true,
        accessToken: data.access_token
      };

    } catch (error) {
      console.error('GitHub OAuth - Token exchange failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to exchange code for token'
      };
    }
  }

  // Get user information
  async getUserInfo(accessToken: string): Promise<{ success: boolean; user?: GitHubUser; error?: string }> {
    try {
      const response = await fetch(this.USER_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Easy-Hybrid-App'
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const userData = await response.json();

      const user: GitHubUser = {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
      };

      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user info'
      };
    }
  }

  // Check if we're currently handling an OAuth callback
  isOAuthCallback(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('code') && urlParams.has('state');
  }

  // Complete OAuth flow (main entry point)
  async authenticateWithGitHub(): Promise<OAuthResult> {
    try {
      // Check if we're in a callback
      if (this.isOAuthCallback()) {
        return await this.handleOAuthCallback();
      } else {
        // Initiate OAuth flow
        this.initiateOAuthFlow();
        // This will redirect the page, so we return a pending result
        return {
          success: false,
          error: 'Redirecting to GitHub for authentication...'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }
}

// Export singleton instance
export const githubOAuthService = new GitHubOAuthService();
