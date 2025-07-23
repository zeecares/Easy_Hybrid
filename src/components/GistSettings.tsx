import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Settings, Github, Check, AlertCircle, RefreshCw, Shield, Lock } from 'lucide-react';
import { gistService } from '../services/gistService';
import { githubOAuthService } from '../services/githubOAuthService';

interface GistSettingsProps {
  onSyncComplete?: () => void;
}

export function GistSettings({ onSyncComplete }: GistSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [status, setStatus] = useState(gistService.getStatus());
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    setStatus(gistService.getStatus());
  }, []);

  const handleGitHubLogin = async () => {
    setIsAuthenticating(true);
    setIsLoading(true);
    setMessage(null);

    try {
      setMessage({ type: 'success', text: 'Opening GitHub authorization... Please check the new tab and authorize Easy Hybrid.' });
      
      const result = await githubOAuthService.authenticateWithGitHub();
      
      if (result.success && result.accessToken) {
        // Setup gist service with OAuth token
        const setupResult = await gistService.setupGist(result.accessToken, true);
        
        if (setupResult.success) {
          setMessage({ type: 'success', text: `Welcome ${result.user?.name || result.user?.login}! GitHub backup enabled.` });
          setStatus(gistService.getStatus());
          
          // Perform initial backup
          const backupResult = await gistService.backupToGist();
          if (backupResult.success) {
            setMessage({ type: 'success', text: 'Login successful! Your data has been backed up to your private GitHub gist.' });
            onSyncComplete?.();
          } else {
            setMessage({ type: 'error', text: `Login successful, but backup failed: ${backupResult.error}` });
          }
        } else {
          setMessage({ type: 'error', text: setupResult.error || 'Failed to setup GitHub integration' });
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'GitHub authorization failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred during GitHub login' });
    } finally {
      setIsLoading(false);
      setIsAuthenticating(false);
    }
  };

  const handleBackup = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await gistService.backupToGist();
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Data backed up successfully!' });
        setStatus(gistService.getStatus());
        onSyncComplete?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Backup failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('This will replace your current data with data from GitHub. Continue?')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await gistService.restoreFromGist();
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Data restored from GitHub successfully!' });
        setStatus(gistService.getStatus());
        onSyncComplete?.();
        // Refresh the page to show updated data
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage({ type: 'error', text: result.error || 'Restore failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = () => {
    if (confirm('This will disable GitHub sync. Your data will remain in localStorage. Continue?')) {
      gistService.disable();
      setStatus(gistService.getStatus());
      setMessage({ type: 'success', text: 'GitHub integration disabled' });
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2">
        {status.enabled ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Cloud className="w-4 h-4" />
            <span>GitHub Sync</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CloudOff className="w-4 h-4" />
            <span>No Backup</span>
          </div>
        )}
        <button
          onClick={() => setIsOpen(true)}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          title="Backup Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              GitHub Backup
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>

          {!status.enabled ? (
            <div>
              {/* Privacy First Messaging */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">100% Privacy Guaranteed</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    <span>Your data goes directly to YOUR GitHub account</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    <span>We never see or store your attendance data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    <span>Private gists - only you can access your data</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Login with GitHub to automatically backup your attendance data to a private gist. 
                This enables seamless cross-device sync and protects against data loss.
              </p>

              <button
                onClick={handleGitHubLogin}
                disabled={isLoading || isAuthenticating}
                className="w-full bg-gray-900 text-white py-3 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-3 font-medium"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Github className="w-5 h-5" />
                )}
                {isAuthenticating ? 'Connecting to GitHub...' : 'Login with GitHub'}
              </button>
              
              <p className="text-xs text-gray-500 mt-2 text-center">
                You'll be redirected to GitHub to authorize Easy Hybrid
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700">GitHub Backup Enabled</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Status: {status.hasGist ? '✅ Active' : '⚠️ Setting up...'}</div>
                  <div>Last sync: {formatLastSync(status.lastSync)}</div>
                  <div>Auto-sync: {status.autoSync ? '✅ Enabled' : '❌ Disabled'}</div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleBackup}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  Backup Now
                </button>

                <button
                  onClick={handleRestore}
                  disabled={isLoading}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Restore from GitHub
                </button>

                <button
                  onClick={handleDisable}
                  className="w-full bg-red-100 text-red-700 py-2 px-4 rounded-md hover:bg-red-200 border border-red-200"
                >
                  Disable GitHub Backup
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`mt-4 p-3 rounded-md flex items-center gap-2 ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span><strong>Zero Data Collection:</strong> Your attendance data never touches our servers</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span><strong>Direct Sync:</strong> Browser ↔ Your GitHub Account (no middleman)</span>
              </div>
              <div className="flex items-center gap-1">
                <Github className="w-3 h-3" />
                <span><strong>You Own Everything:</strong> Data lives in your private GitHub gists</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
