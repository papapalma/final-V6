import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isUserAdmin,
  isUserSuperAdmin,
  getCurrentUser,
  checkAdminAuthorization,
  isOperationAuthorized,
  canEditSettings,
  canDeleteVersions,
  canViewAuditLogs,
  formatRoleName,
  getUserDisplayName,
  type AuthUser,
} from './adminAuthCheck';

/**
 * Unit Tests: Admin Authorization Check
 *
 * Tests the admin authorization utility for:
 * - Admin user can access admin panel
 * - Non-admin user redirected
 * - Error message displayed
 * - Integration with existing auth system
 *
 * **Validates: Requirements 12.1, 12.2, 12.3**
 */

describe('Admin Authorization Check', () => {
  const adminUser: AuthUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
  };

  const superadminUser: AuthUser = {
    id: 'superadmin-1',
    email: 'superadmin@example.com',
    role: 'superadmin',
  };

  const regularUser: AuthUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user',
  };

  beforeEach(() => {
    // Clean up storage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('isUserAdmin', () => {
    it('should return true for admin user', () => {
      expect(isUserAdmin(adminUser)).toBe(true);
    });

    it('should return true for superadmin user', () => {
      expect(isUserAdmin(superadminUser)).toBe(true);
    });

    it('should return false for regular user', () => {
      expect(isUserAdmin(regularUser)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isUserAdmin(null)).toBe(false);
    });

    it('should return false for undefined user', () => {
      expect(isUserAdmin(undefined)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const upperAdmin = { ...adminUser, role: 'ADMIN' };
      expect(isUserAdmin(upperAdmin)).toBe(true);
    });
  });

  describe('isUserSuperAdmin', () => {
    it('should return true for superadmin user', () => {
      expect(isUserSuperAdmin(superadminUser)).toBe(true);
    });

    it('should return false for regular admin', () => {
      expect(isUserSuperAdmin(adminUser)).toBe(false);
    });

    it('should return false for regular user', () => {
      expect(isUserSuperAdmin(regularUser)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isUserSuperAdmin(null)).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should retrieve user from localStorage', () => {
      localStorage.setItem('auth_user', JSON.stringify(adminUser));

      const user = getCurrentUser();

      expect(user).toEqual(adminUser);
    });

    it('should retrieve user from sessionStorage', () => {
      sessionStorage.setItem('auth_user', JSON.stringify(adminUser));

      const user = getCurrentUser();

      expect(user).toEqual(adminUser);
    });

    it('should prefer localStorage over sessionStorage', () => {
      localStorage.setItem('auth_user', JSON.stringify(adminUser));
      sessionStorage.setItem('auth_user', JSON.stringify(regularUser));

      const user = getCurrentUser();

      expect(user).toEqual(adminUser);
    });

    it('should return null when no user in storage', () => {
      const user = getCurrentUser();

      expect(user).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('auth_user', 'invalid-json');

      const user = getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('checkAdminAuthorization', () => {
    it('should authorize admin user', () => {
      localStorage.setItem('auth_user', JSON.stringify(adminUser));

      const result = checkAdminAuthorization();

      expect(result.isAuthorized).toBe(true);
      expect(result.message).toContain('Welcome');
      expect(result.user).toEqual(adminUser);
    });

    it('should authorize superadmin user', () => {
      localStorage.setItem('auth_user', JSON.stringify(superadminUser));

      const result = checkAdminAuthorization();

      expect(result.isAuthorized).toBe(true);
    });

    it('should deny non-admin user', () => {
      localStorage.setItem('auth_user', JSON.stringify(regularUser));

      const result = checkAdminAuthorization();

      expect(result.isAuthorized).toBe(false);
      expect(result.message).toContain('Access denied');
      expect(result.message).toContain('user');
      expect(result.user).toEqual(regularUser);
    });

    it('should deny unauthenticated user', () => {
      const result = checkAdminAuthorization();

      expect(result.isAuthorized).toBe(false);
      expect(result.message).toContain('must be logged in');
    });
  });

  describe('isOperationAuthorized', () => {
    it('should allow admin to save settings', () => {
      expect(isOperationAuthorized('save_settings', adminUser)).toBe(true);
    });

    it('should allow superadmin to save settings', () => {
      expect(isOperationAuthorized('save_settings', superadminUser)).toBe(true);
    });

    it('should deny regular user to save settings', () => {
      expect(isOperationAuthorized('save_settings', regularUser)).toBe(false);
    });

    it('should allow superadmin to delete all settings', () => {
      expect(isOperationAuthorized('delete_all_settings', superadminUser)).toBe(true);
    });

    it('should deny admin to delete all settings', () => {
      expect(isOperationAuthorized('delete_all_settings', adminUser)).toBe(false);
    });

    it('should use current user if none provided', () => {
      localStorage.setItem('auth_user', JSON.stringify(adminUser));

      expect(isOperationAuthorized('save_settings')).toBe(true);
    });
  });

  describe('canEditSettings', () => {
    it('should allow admin to edit', () => {
      expect(canEditSettings(adminUser)).toBe(true);
    });

    it('should allow superadmin to edit', () => {
      expect(canEditSettings(superadminUser)).toBe(true);
    });

    it('should deny regular user', () => {
      expect(canEditSettings(regularUser)).toBe(false);
    });

    it('should deny null user', () => {
      expect(canEditSettings(null)).toBe(false);
    });
  });

  describe('canDeleteVersions', () => {
    it('should allow superadmin only', () => {
      expect(canDeleteVersions(superadminUser)).toBe(true);
    });

    it('should deny admin user', () => {
      expect(canDeleteVersions(adminUser)).toBe(false);
    });

    it('should deny regular user', () => {
      expect(canDeleteVersions(regularUser)).toBe(false);
    });
  });

  describe('canViewAuditLogs', () => {
    it('should allow admin to view', () => {
      expect(canViewAuditLogs(adminUser)).toBe(true);
    });

    it('should allow superadmin to view', () => {
      expect(canViewAuditLogs(superadminUser)).toBe(true);
    });

    it('should deny regular user', () => {
      expect(canViewAuditLogs(regularUser)).toBe(false);
    });
  });

  describe('formatRoleName', () => {
    it('should format single word role', () => {
      expect(formatRoleName('admin')).toBe('Admin');
      expect(formatRoleName('user')).toBe('User');
    });

    it('should format multi-word role', () => {
      expect(formatRoleName('super_admin')).toBe('Super Admin');
      expect(formatRoleName('content_editor')).toBe('Content Editor');
    });

    it('should preserve mixed case', () => {
      expect(formatRoleName('ADMIN')).toBe('ADMIN');
    });
  });

  describe('getUserDisplayName', () => {
    it('should return email for valid user', () => {
      const name = getUserDisplayName(adminUser);
      expect(name).toBe('admin@example.com');
    });

    it('should return ID-based fallback if no email', () => {
      const user = { id: 'test-id', email: '', role: 'admin' };
      const name = getUserDisplayName(user);
      expect(name).toContain('User');
    });

    it('should return unknown for null user', () => {
      expect(getUserDisplayName(null)).toBe('Unknown User');
    });

    it('should return unknown for undefined user', () => {
      expect(getUserDisplayName(undefined)).toBe('Unknown User');
    });
  });

  describe('Authorization Scenarios', () => {
    it('should allow admin user full access to admin panel', () => {
      localStorage.setItem('auth_user', JSON.stringify(adminUser));

      const authCheck = checkAdminAuthorization();
      const canEdit = canEditSettings(adminUser);
      const canViewLogs = canViewAuditLogs(adminUser);

      expect(authCheck.isAuthorized).toBe(true);
      expect(canEdit).toBe(true);
      expect(canViewLogs).toBe(true);
    });

    it('should allow superadmin full access including destructive operations', () => {
      localStorage.setItem('auth_user', JSON.stringify(superadminUser));

      const authCheck = checkAdminAuthorization();
      const canDelete = canDeleteVersions(superadminUser);
      const canDeleteAll = isOperationAuthorized('delete_all_settings', superadminUser);

      expect(authCheck.isAuthorized).toBe(true);
      expect(canDelete).toBe(true);
      expect(canDeleteAll).toBe(true);
    });

    it('should deny regular user all admin operations', () => {
      localStorage.setItem('auth_user', JSON.stringify(regularUser));

      const authCheck = checkAdminAuthorization();
      const canEdit = canEditSettings(regularUser);
      const canDelete = canDeleteVersions(regularUser);

      expect(authCheck.isAuthorized).toBe(false);
      expect(canEdit).toBe(false);
      expect(canDelete).toBe(false);
    });

    it('should provide clear error messages for access denial', () => {
      localStorage.setItem('auth_user', JSON.stringify(regularUser));

      const result = checkAdminAuthorization();

      expect(result.isAuthorized).toBe(false);
      expect(result.message).toContain('Access denied');
      expect(result.message).toContain('user');
      expect(result.message).toContain('admin');
    });
  });
});
