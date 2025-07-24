import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitHubLoginButton } from '../components/GitHubLoginButton';
import { gistService } from '../services/gistService';
import { githubOAuthService } from '../services/githubOAuthService';
import { localStorageMock } from './setup';

// Mock the services
vi.mock('../services/gistService');
vi.mock('../services/githubOAuthService');

describe('GitHubLoginButton', () => {
  const mockGistService = vi.mocked(gistService);
  const mockGitHubOAuthService = vi.mocked(githubOAuthService);
  const mockOnSyncComplete = vi.fn();

  const mockUser = {
    login: 'testuser',
    name: 'Test User',
    avatar_url: 'https://avatars.githubusercontent.com/u/123456'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Default mock implementations
    mockGistService.getStatus.mockReturnValue({
      enabled: false,
      hasGist: false,
      autoSync: false
    });
    
    mockGistService.setupGist.mockResolvedValue({ success: true });
    mockGistService.restoreFromGist.mockResolvedValue({ success: false });
    mockGistService.backupToGist.mockResolvedValue({ success: true });
    mockGistService.disable.mockImplementation(() => {});
    
    mockGitHubOAuthService.authenticateWithGitHub.mockResolvedValue({
      success: true,
      accessToken: 'test_token',
      user: mockUser
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial render - not connected', () => {
    it('should render login button when not connected', () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      expect(screen.getByText('Login with GitHub')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveClass('bg-gray-900');
    });

    it('should not show user avatar or logout when not connected', () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Disconnect from GitHub')).not.toBeInTheDocument();
    });
  });

  describe('Connected state', () => {
    beforeEach(() => {
      // Mock connected state
      mockGistService.getStatus.mockReturnValue({
        enabled: true,
        hasGist: true,
        autoSync: true
      });
      
      // Mock stored user info
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'github_user') {
          return JSON.stringify(mockUser);
        }
        return null;
      });
    });

    it('should render user avatar and info when connected', async () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.getByRole('img')).toHaveAttribute('src', mockUser.avatar_url);
        expect(screen.getByRole('img')).toHaveAttribute('alt', mockUser.name);
      });
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should render logout button when connected', async () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      await waitFor(() => {
        expect(screen.getByTitle('Disconnect from GitHub')).toBeInTheDocument();
      });
    });

    it('should not render login button when connected', async () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Login with GitHub')).not.toBeInTheDocument();
      });
    });
  });

  describe('Login flow', () => {
    it('should show loading state during login', async () => {
      // Mock delayed OAuth response
      mockGitHubOAuthService.authenticateWithGitHub.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          accessToken: 'test_token',
          user: mockUser
        }), 100))
      );

      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      const loginButton = screen.getByText('Login with GitHub');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
      });
    });

    it('should handle successful login and update UI state', async () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      const loginButton = screen.getByText('Login with GitHub');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(mockGitHubOAuthService.authenticateWithGitHub).toHaveBeenCalled();
        expect(mockGistService.setupGist).toHaveBeenCalledWith('test_token', true);
      });
      
      // Verify localStorage calls
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'github_user', 
        JSON.stringify(mockUser)
      );
    });

    it('should try to restore data from gist on successful login', async () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      const loginButton = screen.getByText('Login with GitHub');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(mockGistService.restoreFromGist).toHaveBeenCalled();
      });
    });

    it('should backup data if restore fails', async () => {
      mockGistService.restoreFromGist.mockResolvedValue({ success: false, error: 'No gist found' });
      
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      const loginButton = screen.getByText('Login with GitHub');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(mockGistService.restoreFromGist).toHaveBeenCalled();
        expect(mockGistService.backupToGist).toHaveBeenCalled();
      });
    });

    it('should call onSyncComplete after successful login', async () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      const loginButton = screen.getByText('Login with GitHub');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(mockOnSyncComplete).toHaveBeenCalled();
      });
    });

    it('should handle login failure', async () => {
      mockGitHubOAuthService.authenticateWithGitHub.mockResolvedValue({
        success: false,
        error: 'OAuth failed'
      });
      
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      const loginButton = screen.getByText('Login with GitHub');
      fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(screen.getByText(/OAuth failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Logout flow', () => {
    beforeEach(() => {
      // Setup connected state
      mockGistService.getStatus.mockReturnValue({
        enabled: true,
        hasGist: true,
        autoSync: true
      });
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'github_user') {
          return JSON.stringify(mockUser);
        }
        return null;
      });
    });

    it('should handle logout and clear user data', async () => {
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      await waitFor(() => {
        const logoutButton = screen.getByTitle('Disconnect from GitHub');
        expect(logoutButton).toBeInTheDocument();
      });
      
      const logoutButton = screen.getByTitle('Disconnect from GitHub');
      fireEvent.click(logoutButton);
      
      await waitFor(() => {
        expect(mockGistService.disable).toHaveBeenCalled();
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('github_user');
      });
    });

    it('should show success message after logout', async () => {
      // Mock updated status after logout
      mockGistService.getStatus
        .mockReturnValueOnce({ enabled: true, hasGist: true, autoSync: true }) // Initial
        .mockReturnValueOnce({ enabled: false, hasGist: false, autoSync: false }); // After logout
      
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      await waitFor(() => {
        const logoutButton = screen.getByTitle('Disconnect from GitHub');
        fireEvent.click(logoutButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Disconnected from GitHub')).toBeInTheDocument();
      });
    });
  });

  describe('State management edge cases', () => {
    it('should handle missing user info in localStorage', () => {
      mockGistService.getStatus.mockReturnValue({
        enabled: true,
        hasGist: true,
        autoSync: true
      });
      
      localStorageMock.getItem.mockReturnValue(null);
      
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      // Should still show connected state but with fallback user display
      expect(screen.getByText('GitHub User')).toBeInTheDocument();
    });

    it('should handle malformed user info in localStorage', () => {
      mockGistService.getStatus.mockReturnValue({
        enabled: true,
        hasGist: true,
        autoSync: true
      });
      
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      // Should not crash and should show fallback
      expect(screen.getByText('GitHub User')).toBeInTheDocument();
    });

    it('should update UI when status changes', async () => {
      const { rerender } = render(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      // Initially not connected
      expect(screen.getByText('Login with GitHub')).toBeInTheDocument();
      
      // Mock status change to connected
      mockGistService.getStatus.mockReturnValue({
        enabled: true,
        hasGist: true,
        autoSync: true
      });
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'github_user') {
          return JSON.stringify(mockUser);
        }
        return null;
      });
      
      rerender(<GitHubLoginButton onSyncComplete={mockOnSyncComplete} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Login with GitHub')).not.toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });
    });
  });
});
