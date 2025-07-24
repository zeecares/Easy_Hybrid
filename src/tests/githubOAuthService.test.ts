import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { githubOAuthService, type GitHubUser, type OAuthResult } from '../services/githubOAuthService';
import { localStorageMock } from './setup';

// Mock fetch globally
global.fetch = vi.fn();

describe('GitHubOAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Reset window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:5173',
        href: 'http://localhost:5173',
        search: '',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOAuthCallback', () => {
    it('should return false when no OAuth parameters in URL', () => {
      window.location.search = '';
      expect(githubOAuthService.isOAuthCallback()).toBe(false);
    });

    it('should return false when only code parameter exists', () => {
      window.location.search = '?code=abc123';
      expect(githubOAuthService.isOAuthCallback()).toBe(false);
    });

    it('should return false when only state parameter exists', () => {
      window.location.search = '?state=xyz789';
      expect(githubOAuthService.isOAuthCallback()).toBe(false);
    });

    it('should return true when both code and state parameters exist', () => {
      window.location.search = '?code=abc123&state=xyz789';
      expect(githubOAuthService.isOAuthCallback()).toBe(true);
    });
  });

  describe('handleOAuthCallback', () => {
    const mockUser: GitHubUser = {
      login: 'testuser',
      name: 'Test User',
      avatar_url: 'https://avatars.githubusercontent.com/u/123456'
    };

    beforeEach(() => {
      // Mock successful token exchange
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('oauth/access_token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token_123' })
          });
        }
        if (url.includes('api.github.com/user')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockUser)
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
    });

    it('should handle successful OAuth callback', async () => {
      // Setup OAuth callback scenario
      window.location.search = '?code=test_code&state=test_state';
      localStorageMock.getItem.mockReturnValue('test_state');

      const result = await githubOAuthService.handleOAuthCallback();

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test_token_123');
      expect(result.user).toEqual(mockUser);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('github_oauth_state');
    });

    it('should reject callback with invalid state', async () => {
      window.location.search = '?code=test_code&state=invalid_state';
      localStorageMock.getItem.mockReturnValue('test_state');

      const result = await githubOAuthService.handleOAuthCallback();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state parameter');
    });

    it('should handle GitHub authorization error', async () => {
      window.location.search = '?error=access_denied&state=test_state';
      localStorageMock.getItem.mockReturnValue('test_state');

      const result = await githubOAuthService.handleOAuthCallback();

      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub authorization failed');
    });

    it('should handle missing authorization code', async () => {
      window.location.search = '?state=test_state';
      localStorageMock.getItem.mockReturnValue('test_state');

      const result = await githubOAuthService.handleOAuthCallback();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No authorization code received');
    });
  });

  describe('authenticateWithGitHub', () => {
    it('should initiate OAuth flow when not in callback', async () => {
      window.location.search = '';
      
      // Mock window.location.href setter
      const mockLocationSetter = vi.fn();
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          href: '',
          set href(url) { mockLocationSetter(url); }
        },
        writable: true,
      });

      const result = await githubOAuthService.authenticateWithGitHub();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Redirecting to GitHub');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('github_oauth_state', expect.any(String));
    });

    it('should handle OAuth callback when in callback', async () => {
      window.location.search = '?code=test_code&state=test_state';
      localStorageMock.getItem.mockReturnValue('test_state');

      // Mock successful API responses
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('oauth/access_token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: 'test_token_123' })
          });
        }
        if (url.includes('api.github.com/user')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              login: 'testuser',
              name: 'Test User',
              avatar_url: 'https://avatars.githubusercontent.com/u/123456'
            })
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const result = await githubOAuthService.authenticateWithGitHub();

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test_token_123');
      expect(result.user?.login).toBe('testuser');
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info successfully', async () => {
      const mockUser = {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/123456'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser)
      });

      const result = await githubOAuthService.getUserInfo('test_token');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_token'
          })
        })
      );
    });

    it('should handle API error', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await githubOAuthService.getUserInfo('invalid_token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub API error: 401');
    });
  });
});
