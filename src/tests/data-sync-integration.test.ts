import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gistService } from '../services/gistService';
import { githubOAuthService } from '../services/githubOAuthService';
import { localStorageMock } from './setup';
import type { GistData } from '../services/gistService';

// Mock fetch globally
global.fetch = vi.fn();

describe('Data Sync Integration', () => {
  const mockFetch = vi.mocked(global.fetch);
  
  const mockAttendanceData = [
    { date: '2024-01-01', present: true, type: 'office' as const },
    { date: '2024-01-02', present: false, type: 'remote' as const }
  ];
  
  const mockHolidaysData = [
    { date: '2024-01-01', name: 'New Year', type: 'public' as const },
    { date: '2024-02-14', name: 'Valentine\'s Day', type: 'personal' as const }
  ];
  
  const mockTargetRate = 60;
  
  const mockGistData: GistData = {
    attendance: mockAttendanceData,
    holidays: mockHolidaysData,
    targetRate: mockTargetRate,
    lastModified: '2024-01-01T00:00:00.000Z',
    version: '1.0'
  };

  const mockUser = {
    login: 'testuser',
    name: 'Test User',
    avatar_url: 'https://avatars.githubusercontent.com/u/123456'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Reset gist service state
    gistService.disable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete OAuth and Data Sync Flow', () => {
    it('should complete full login flow with data restore', async () => {
      // Step 1: Mock OAuth callback handling
      const mockOAuthCallback = vi.fn().mockResolvedValue({
        success: true,
        accessToken: 'test_access_token',
        user: mockUser
      });
      
      vi.spyOn(githubOAuthService, 'handleOAuthCallback').mockImplementation(mockOAuthCallback);
      vi.spyOn(githubOAuthService, 'isOAuthCallback').mockReturnValue(true);

      // Step 2: Mock GitHub API calls for gist service setup
      mockFetch
        // User validation call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        // Gist list call (find existing gist)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: {
                'easy-hybrid-attendance.json': {
                  content: JSON.stringify(mockGistData)
                }
              }
            }
          ])
        })
        // Get gist data call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            files: {
              'easy-hybrid-attendance.json': {
                content: JSON.stringify(mockGistData)
              }
            }
          })
        });

      // Step 3: Set up gist service
      const setupResult = await gistService.setupGist('test_access_token', true);
      expect(setupResult.success).toBe(true);

      // Step 4: Restore data from gist
      const restoreResult = await gistService.restoreFromGist();
      expect(restoreResult.success).toBe(true);

      // Step 5: Verify localStorage was updated
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'attendance',
        JSON.stringify(mockAttendanceData)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'holidays',
        JSON.stringify(mockHolidaysData)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'targetRate',
        mockTargetRate.toString()
      );

      // Step 6: Verify service status
      const status = gistService.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.hasGist).toBe(true);
      expect(status.autoSync).toBe(true);
    });

    it('should backup local data when no gist exists', async () => {
      // Mock local data
      localStorageMock.getItem.mockImplementation((key) => {
        switch (key) {
          case 'attendance':
            return JSON.stringify(mockAttendanceData);
          case 'holidays':
            return JSON.stringify(mockHolidaysData);
          case 'targetRate':
            return mockTargetRate.toString();
          default:
            return null;
        }
      });

      // Mock GitHub API calls
      mockFetch
        // User validation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        // Gist list (no existing gist)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        })
        // Create new gist
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'new_gist_id'
          })
        });

      // Set up gist service
      const setupResult = await gistService.setupGist('test_access_token', true);
      expect(setupResult.success).toBe(true);

      // Verify gist was created with local data
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/gists',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(JSON.stringify(mockAttendanceData))
        })
      );
    });

    it('should sync new changes to gist automatically', async () => {
      // Set up gist service first
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: { 'easy-hybrid-attendance.json': {} }
            }
          ])
        });

      await gistService.setupGist('test_access_token', true);

      // Mock new local data
      const newAttendanceData = [
        ...mockAttendanceData,
        { date: '2024-01-03', present: true, type: 'office' as const }
      ];

      localStorageMock.getItem.mockImplementation((key) => {
        switch (key) {
          case 'attendance':
            return JSON.stringify(newAttendanceData);
          case 'holidays':
            return JSON.stringify(mockHolidaysData);
          case 'targetRate':
            return mockTargetRate.toString();
          default:
            return null;
        }
      });

      // Mock gist update call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      // Perform sync
      const syncResult = await gistService.syncNow();
      expect(syncResult.success).toBe(true);

      // Verify gist was updated with new data
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/gists/test_gist_id',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining(JSON.stringify(newAttendanceData))
        })
      );
    });

    it('should handle sync conflicts gracefully', async () => {
      // Set up gist service
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: { 'easy-hybrid-attendance.json': {} }
            }
          ])
        });

      await gistService.setupGist('test_access_token', true);

      // Mock failed sync (e.g., network error)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const syncResult = await gistService.syncNow();
      expect(syncResult.success).toBe(false);
      expect(syncResult.error).toContain('Network error');
    });

    it('should handle authentication errors during sync', async () => {
      // Set up gist service
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: { 'easy-hybrid-attendance.json': {} }
            }
          ])
        });

      await gistService.setupGist('test_access_token', true);

      // Mock authentication error (401)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const syncResult = await gistService.syncNow();
      expect(syncResult.success).toBe(false);
      expect(syncResult.error).toContain('GitHub API error: 401');
    });
  });

  describe('Data Validation and Integrity', () => {
    it('should validate gist data structure', async () => {
      const invalidGistData = {
        // Missing required fields
        attendance: mockAttendanceData,
        // holidays missing
        // targetRate missing
        lastModified: '2024-01-01T00:00:00.000Z',
        version: '1.0'
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: { 'easy-hybrid-attendance.json': {} }
            }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            files: {
              'easy-hybrid-attendance.json': {
                content: JSON.stringify(invalidGistData)
              }
            }
          })
        });

      await gistService.setupGist('test_access_token', true);

      // This should handle invalid data gracefully
      const result = await gistService.getGistData();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle malformed JSON in gist', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: { 'easy-hybrid-attendance.json': {} }
            }
          ])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            files: {
              'easy-hybrid-attendance.json': {
                content: 'invalid json content {'
              }
            }
          })
        });

      await gistService.setupGist('test_access_token', true);

      const result = await gistService.getGistData();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Throttling and Rate Limiting', () => {
    it('should throttle auto-sync requests', async () => {
      // Set up gist service
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: { 'easy-hybrid-attendance.json': {} }
            }
          ])
        });

      await gistService.setupGist('test_access_token', true);

      // Mock recent sync time (less than 1 hour ago)
      const recentSyncTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago
      vi.spyOn(gistService, 'getStatus').mockReturnValue({
        enabled: true,
        hasGist: true,
        autoSync: true,
        lastSync: recentSyncTime
      });

      // Auto-sync should be skipped due to throttling
      await gistService.autoSyncIfNeeded();

      // Should not make any additional API calls for sync
      expect(mockFetch).toHaveBeenCalledTimes(2); // Only the setup calls
    });

    it('should allow immediate sync to bypass throttling', async () => {
      // Set up gist service
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'test_gist_id',
              description: 'Easy Hybrid Office Attendance Data',
              files: { 'easy-hybrid-attendance.json': {} }
            }
          ])
        })
        // Immediate sync call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        });

      await gistService.setupGist('test_access_token', true);

      // Immediate sync should work regardless of throttling
      const syncResult = await gistService.syncNow();
      expect(syncResult.success).toBe(true);

      // Should make sync API call
      expect(mockFetch).toHaveBeenCalledTimes(3); // Setup + sync calls
    });
  });
});