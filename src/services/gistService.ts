import type { AttendanceRecord, Holiday } from '../types/attendance';

export interface GistData {
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  targetRate: number;
  lastModified: string;
  version: string;
}

export interface GistConfig {
  token: string;
  gistId?: string;
  enabled: boolean;
  autoSync: boolean;
  lastSyncTime?: string;
}

export class GistService {
  private config: GistConfig | null = null;
  private readonly GIST_FILENAME = 'easy-hybrid-attendance.json';
  private readonly GIST_DESCRIPTION = 'Easy Hybrid Office Attendance Data';

  constructor() {
    this.loadConfig();
  }

  // Load Gist configuration from localStorage
  private loadConfig(): void {
    const saved = localStorage.getItem('gistConfig');
    if (saved) {
      try {
        this.config = JSON.parse(saved);
      } catch (error) {
        console.warn('Failed to parse Gist config:', error);
        this.config = null;
      }
    }
  }

  // Save Gist configuration to localStorage
  private saveConfig(): void {
    if (this.config) {
      localStorage.setItem('gistConfig', JSON.stringify(this.config));
    } else {
      localStorage.removeItem('gistConfig');
    }
  }

  // Set up Gist integration with user's token
  async setupGist(token: string, autoSync: boolean = true): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate token by making a test API call
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid GitHub token');
      }

      await response.json();
      
      // Set up initial config
      this.config = {
        token,
        enabled: true,
        autoSync,
        lastSyncTime: new Date().toISOString(),
      };
      
      // Try to find existing gist first
      const existingGist = await this.findExistingGist();
      if (existingGist.success && existingGist.gistId) {
        this.config.gistId = existingGist.gistId;
        this.saveConfig();
        return { success: true };
      }
      
      // If no existing gist found, create a new one with default data
      const defaultData: GistData = {
        attendance: [],
        holidays: [],
        targetRate: 0.6,
        lastModified: new Date().toISOString(),
        version: '1.0.0'
      };
      
      const createResult = await this.createGist(defaultData);
      if (createResult.success) {
        return { success: true };
      } else {
        return { success: false, error: createResult.error };
      }
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Find existing gist with attendance data
  private async findExistingGist(): Promise<{ success: boolean; gistId?: string; error?: string }> {
    if (!this.config?.token) {
      return { success: false, error: 'No GitHub token configured' };
    }

    try {
      const response = await fetch('https://api.github.com/gists', {
        headers: {
          'Authorization': `bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const gists = await response.json();
      
      // Look for a gist with our filename and description
      const existingGist = gists.find((gist: { description: string; files: Record<string, unknown>; id: string }) => 
        gist.description === this.GIST_DESCRIPTION &&
        gist.files[this.GIST_FILENAME]
      );
      
      if (existingGist) {
        return { success: true, gistId: existingGist.id };
      } else {
        return { success: false, error: 'No existing gist found' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search gists'
      };
    }
  }

  // Create a new private gist with attendance data
  private async createGist(data: GistData): Promise<{ success: boolean; gistId?: string; error?: string }> {
    if (!this.config?.token) {
      return { success: false, error: 'No GitHub token configured' };
    }

    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: this.GIST_DESCRIPTION,
          public: false,
          files: {
            [this.GIST_FILENAME]: {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const gist = await response.json();
      
      // Update config with gist ID
      this.config.gistId = gist.id;
      this.saveConfig();
      
      return { success: true, gistId: gist.id };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create gist' 
      };
    }
  }

  // Update existing gist with new data
  private async updateGist(gistId: string, data: GistData): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.token) {
      return { success: false, error: 'No GitHub token configured' };
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            [this.GIST_FILENAME]: {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update gist' 
      };
    }
  }

  // Get data from existing gist
  async getGistData(): Promise<{ success: boolean; data?: GistData; error?: string }> {
    if (!this.config?.token || !this.config?.gistId) {
      return { success: false, error: 'No gist configured' };
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        headers: {
          'Authorization': `bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const gist = await response.json();
      const fileContent = gist.files[this.GIST_FILENAME]?.content;
      
      if (!fileContent) {
        throw new Error('Attendance data not found in gist');
      }

      const data = JSON.parse(fileContent);
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch gist data' 
      };
    }
  }

  // Backup current localStorage data to Gist
  async backupToGist(): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.enabled) {
      return { success: false, error: 'Gist integration not enabled' };
    }

    try {
      // Get current data from localStorage
      const attendance = JSON.parse(localStorage.getItem('attendance') || '[]');
      const holidays = JSON.parse(localStorage.getItem('holidays') || '[]');
      const targetRate = parseFloat(localStorage.getItem('targetRate') || '50');

      const data: GistData = {
        attendance,
        holidays,
        targetRate,
        lastModified: new Date().toISOString(),
        version: '1.0',
      };

      let result;
      if (this.config.gistId) {
        // Update existing gist
        result = await this.updateGist(this.config.gistId, data);
      } else {
        // Create new gist
        result = await this.createGist(data);
      }

      if (result.success) {
        // Update last sync time
        this.config.lastSyncTime = new Date().toISOString();
        this.saveConfig();
      }

      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Backup failed' 
      };
    }
  }

  // Restore data from Gist to localStorage
  async restoreFromGist(): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.enabled) {
      return { success: false, error: 'Gist integration not enabled' };
    }

    try {
      const result = await this.getGistData();
      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'No data found' };
      }

      const { attendance, holidays, targetRate } = result.data;

      // Update localStorage
      localStorage.setItem('attendance', JSON.stringify(attendance));
      localStorage.setItem('holidays', JSON.stringify(holidays));
      localStorage.setItem('targetRate', targetRate.toString());

      // Update last sync time
      if (this.config) {
        this.config.lastSyncTime = new Date().toISOString();
        this.saveConfig();
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Restore failed' 
      };
    }
  }

  // Check if Gist integration is set up and enabled
  isEnabled(): boolean {
    return Boolean(this.config?.enabled && this.config?.token);
  }

  // Get current configuration status
  getStatus(): {
    enabled: boolean;
    hasGist: boolean;
    lastSync?: string;
    autoSync: boolean;
  } {
    return {
      enabled: Boolean(this.config?.enabled),
      hasGist: Boolean(this.config?.gistId),
      lastSync: this.config?.lastSyncTime,
      autoSync: Boolean(this.config?.autoSync),
    };
  }

  // Disable Gist integration
  disable(): void {
    this.config = null;
    localStorage.removeItem('gistConfig');
  }

  // Auto-sync if enabled and conditions are met (with throttle)
  async autoSyncIfNeeded(): Promise<void> {
    if (!this.config?.enabled || !this.config?.autoSync) {
      return;
    }

    // Auto-sync if it's been more than 1 hour since last sync
    const lastSync = this.config.lastSyncTime;
    if (lastSync) {
      const hoursSinceLastSync = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSync < 1) {
        return; // Too soon
      }
    }

    // Perform backup silently in background
    try {
      await this.backupToGist();
    } catch (error) {
      // Silent fail for auto-sync
      console.warn('Auto-sync failed:', error);
    }
  }

  // Immediate sync for user-triggered actions (bypasses throttle)
  async syncNow(): Promise<{ success: boolean; error?: string }> {
    if (!this.config?.enabled) {
      return { success: false, error: 'Gist integration not enabled' };
    }

    try {
      const result = await this.backupToGist();
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      };
    }
  }
}

// Export singleton instance
export const gistService = new GistService();
