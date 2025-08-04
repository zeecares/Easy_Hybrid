import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { gistService } from '../services/gistService';
import { githubOAuthService } from '../services/githubOAuthService';
import { localStorageMock } from './setup';

// Mock the services
vi.mock('../services/gistService');
vi.mock('../services/githubOAuthService');

describe('App OAuth Integration', () => {
  const mockGistService = vi.mocked(gistService);
  const mockGitHubOAuthService = vi.mocked(githubOAuthService);

  const mockUser = {
    login: 'testuser',
    name: 'Test User',
    avatar_url: 'https://avatars.githubusercontent.com/u/123456'
  };

  const mockHistoryReplaceState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Mock window.history
    Object.defineProperty(window, 'history', {
      value: { replaceState: mockHistoryReplaceState },
      writable: true,
    });

    // Default mock implementations
    mockGistService.getStatus.mockReturnValue({
      enabled: false,
      hasGist: false,
      autoSync: false
    });
    
    mockGistService.isEnabled.mockReturnValue(false);
    mockGistService.setupGist.mockResolvedValue({ success: true });
    mockGistService.restoreFromGist.mockResolvedValue({ success: false });
    mockGistService.backupToGist.mockResolvedValue({ success: true });
    mockGistService.autoSyncIfNeeded.mockResolvedValue();
    mockGistService.syncNow.mockResolvedValue({ success: true });
    
    mockGitHubOAuthService.isOAuthCallback.mockReturnValue(false);
    mockGitHubOAuthService.handleOAuthCallback.mockResolvedValue({
      success: true,
      accessToken: 'test_token',
      user: mockUser
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OAuth Callback Handling', () => {
    it('should handle OAuth callback on app load when callback params are present', async () => {
      // Mock OAuth callback detection
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(true);
      
      // Mock successful restore from gist
      mockGistService.restoreFromGist.mockResolvedValue({ success: true });

      render(<App />);

      await waitFor(() => {
        expect(mockGitHubOAuthService.isOAuthCallback).toHaveBeenCalled();
        expect(mockGitHubOAuthService.handleOAuthCallback).toHaveBeenCalled();
      });

      // Should setup gist service with token
      expect(mockGistService.setupGist).toHaveBeenCalledWith('test_token', true);
      
      // Should store user info
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'github_user', 
        JSON.stringify(mockUser)
      );
      
      // Should try to restore from gist
      expect(mockGistService.restoreFromGist).toHaveBeenCalled();
      
      // Should clean up URL
      expect(mockHistoryReplaceState).toHaveBeenCalledWith(
        {}, 
        expect.any(String), 
        expect.stringContaining(window.location.origin)
      );
    });

    it('should backup to gist if restore fails during OAuth callback', async () => {
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(true);
      mockGistService.restoreFromGist.mockResolvedValue({ success: false });

      render(<App />);

      await waitFor(() => {
        expect(mockGistService.restoreFromGist).toHaveBeenCalled();
        expect(mockGistService.backupToGist).toHaveBeenCalled();
      });
    });

    it('should handle OAuth callback failure gracefully', async () => {
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(true);
      mockGitHubOAuthService.handleOAuthCallback.mockResolvedValue({
        success: false,
        error: 'OAuth failed'
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<App />);

      await waitFor(() => {
        expect(mockGitHubOAuthService.handleOAuthCallback).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('OAuth callback handling failed:', expect.any(Error));
      });

      // Should still clean up URL even on failure
      expect(mockHistoryReplaceState).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle gist setup failure during OAuth callback', async () => {
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(true);
      mockGistService.setupGist.mockResolvedValue({ 
        success: false, 
        error: 'Setup failed' 
      });

      render(<App />);

      await waitFor(() => {
        expect(mockGistService.setupGist).toHaveBeenCalled();
        // Should not try to restore/backup if setup fails
        expect(mockGistService.restoreFromGist).not.toHaveBeenCalled();
        expect(mockGistService.backupToGist).not.toHaveBeenCalled();
      });
    });

    it('should not handle OAuth callback when not in callback state', async () => {
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(false);

      render(<App />);

      await waitFor(() => {
        expect(mockGitHubOAuthService.isOAuthCallback).toHaveBeenCalled();
      });

      // Should not call callback handler
      expect(mockGitHubOAuthService.handleOAuthCallback).not.toHaveBeenCalled();
      expect(mockGistService.setupGist).not.toHaveBeenCalled();
    });

    it('should update component state after successful data restore', async () => {
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(true);
      mockGistService.restoreFromGist.mockResolvedValue({ success: true });

      // Mock localStorage data that would be restored
      const mockAttendance = [{ date: '2024-01-01', present: true, type: 'office' }];
      const mockHolidays = [{ date: '2024-01-01', name: 'New Year', type: 'public' }];
      const mockTargetRate = '60';

      localStorageMock.getItem.mockImplementation((key) => {
        switch (key) {
          case 'attendance':
            return JSON.stringify(mockAttendance);
          case 'holidays':
            return JSON.stringify(mockHolidays);
          case 'targetRate':
            return mockTargetRate;
          default:
            return null;
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(mockGistService.restoreFromGist).toHaveBeenCalled();
        expect(localStorageMock.getItem).toHaveBeenCalledWith('attendance');
        expect(localStorageMock.getItem).toHaveBeenCalledWith('holidays');
        expect(localStorageMock.getItem).toHaveBeenCalledWith('targetRate');
      });
    });
  });

  describe('Normal App Behavior', () => {
    it('should render app normally when not in OAuth callback', async () => {
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(false);

      render(<App />);

      // Should render main app elements
      expect(screen.getByText('Easy Hybrid')).toBeInTheDocument();
      expect(screen.getByText('Track your hybrid office attendance and achieve your target rate')).toBeInTheDocument();
    });

    it('should set up periodic sync when gist is enabled', async () => {
      mockGitHubOAuthService.isOAuthCallback.mockReturnValue(false);
      mockGistService.isEnabled.mockReturnValue(true);

      render(<App />);

      // Should call background sync on load
      expect(mockGistService.autoSyncIfNeeded).toHaveBeenCalled();
    });
  });
});