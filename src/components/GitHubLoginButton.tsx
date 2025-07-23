import { useState, useEffect } from 'react';
import { Github, Check, AlertCircle, Loader2 } from 'lucide-react';
import { gistService } from '../services/gistService';
import { githubOAuthService } from '../services/githubOAuthService';

interface GitHubLoginButtonProps {
  onSyncComplete?: () => void;
}

export function GitHubLoginButton({ onSyncComplete }: GitHubLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(gistService.getStatus());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setStatus(gistService.getStatus());
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
          setStatus(gistService.getStatus());
          
          // Perform initial backup
          const backupResult = await gistService.backupToGist();
          if (backupResult.success) {
            setMessage({ 
              type: 'success', 
              text: `Welcome ${result.user?.name || result.user?.login}! Data backed up to GitHub.` 
            });
            onSyncComplete?.();
          } else {
            setMessage({ type: 'error', text: `Login successful, but backup failed: ${backupResult.error}` });
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
      setStatus(gistService.getStatus());
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
        <button
          onClick={handleDisconnect}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg border border-green-200 hover:bg-green-200 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">GitHub Connected</span>
        </button>
        {message && (
          <div className={`text-xs px-2 py-1 rounded ${
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
