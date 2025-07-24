import { useState, useEffect } from 'react';
import { Github, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { gistService } from '../services/gistService';
import { githubOAuthService, type GitHubUser } from '../services/githubOAuthService';

interface GitHubLoginButtonProps {
  onSyncComplete?: () => void;
}

export function GitHubLoginButton({ onSyncComplete }: GitHubLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(gistService.getStatus());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);

  // Function to refresh status and user info
  const refreshStatus = () => {
    const currentStatus = gistService.getStatus();
    setStatus(currentStatus);
    
    // Load user info if we're connected
    if (currentStatus.enabled && currentStatus.hasGist) {
      const userInfo = localStorage.getItem('github_user');
      
      if (userInfo) {
        try {
          setUser(JSON.parse(userInfo));
        } catch {
          console.warn('Failed to load user info');
          setUser(null);
        }
      }
    } else {
      setUser(null);
    }
  };

  // Check status on every render to pick up changes (including mocked changes in tests)
  const currentGistStatus = gistService.getStatus();
  
  // Update status if it has changed
  useEffect(() => {
    if (currentGistStatus.enabled !== status.enabled || 
        currentGistStatus.hasGist !== status.hasGist ||
        currentGistStatus.autoSync !== status.autoSync) {
      refreshStatus();
    }
  }, [currentGistStatus.enabled, currentGistStatus.hasGist, currentGistStatus.autoSync, status.enabled, status.hasGist, status.autoSync]);

  // Initial load
  useEffect(() => {
    refreshStatus();
  }, []);

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      setMessage({ type: 'success', text: 'Opening GitHub authorization...' });
      
      const result = await githubOAuthService.authenticateWithGitHub();
      
      if (result.success && result.accessToken) {
        // Setup gist service with OAuth token
        const setupResult = await gistService.setupGist(result.accessToken, true);
        
        if (setupResult.success) {
          // Store user info for display
          if (result.user) {
            localStorage.setItem('github_user', JSON.stringify(result.user));
            setUser(result.user);
          }
          
          refreshStatus();
          
          // Try to restore data from gist first, then backup current data
          try {
            const restoreResult = await gistService.restoreFromGist();
            if (restoreResult.success) {
              setMessage({ 
                type: 'success', 
                text: `Welcome back ${result.user?.name || result.user?.login}! Data restored from GitHub.` 
              });
              onSyncComplete?.(); // Refresh UI with restored data
            } else {
              // If restore fails, backup current data
              const backupResult = await gistService.backupToGist();
              if (backupResult.success) {
                setMessage({ 
                  type: 'success', 
                  text: `Welcome ${result.user?.name || result.user?.login}! Data backed up to GitHub.` 
                });
                onSyncComplete?.();
              } else {
                setMessage({ type: 'error', text: `Login successful, but sync failed: ${backupResult.error}` });
              }
            }
          } catch {
            setMessage({ type: 'error', text: 'Login successful, but data sync failed' });
          }
        } else {
          setMessage({ type: 'error', text: setupResult.error || 'Failed to setup GitHub integration' });
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'GitHub authentication failed' });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Authentication failed' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      gistService.disable();
      localStorage.removeItem('github_user');
      refreshStatus();
      setMessage({ type: 'success', text: 'Disconnected from GitHub' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (status.enabled && status.hasGist) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center space-x-3 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
          {/* User Avatar */}
          {user?.avatar_url && (
            <img 
              src={user.avatar_url} 
              alt={user.name || user.login}
              className="w-6 h-6 rounded-full"
            />
          )}
          
          {/* User Info */}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-green-800">
              {user?.name || user?.login || 'GitHub User'}
            </span>
            <span className="text-xs text-green-600">Connected</span>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors disabled:opacity-50"
            title="Disconnect from GitHub"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {message && (
          <div className={`text-xs px-2 py-1 rounded max-w-xs text-center ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleGitHubLogin}
        disabled={isLoading}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Github className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {isLoading ? 'Connecting...' : 'Login with GitHub'}
        </span>
      </button>
      
      {message && (
        <div className={`text-xs px-2 py-1 rounded max-w-xs text-center ${
          message.type === 'success' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'error' && <AlertCircle className="w-3 h-3 inline mr-1" />}
          {message.text}
        </div>
      )}
    </div>
  );
}
