import api from './api';
import {
  encryptToken,
  decryptToken,
  getEncryptedToken,
  setEncryptedToken,
  removeEncryptedToken,
  clearAllEncryptedTokens,
} from '../utils/encryption';

/**
 * Authentication API Service
 * All authentication-related API calls
 * 
 * Security Model (SEC-5):
 * - NO HttpOnly cookies — all tokens are encrypted in sessionStorage
 * - Auth token sent ONLY via Authorization header
 * - Tokens encrypted with AES-256-GCM before storage
 * - Encryption key derived from browser fingerprint (non-persistent)
 * - Cross-origin and same-origin use identical token transmission
 * 
 * Token Storage:
 * - Encrypted in sessionStorage with AES-256-GCM
 * - Lost on page close (inherent to sessionStorage)
 * - Accessible across tabs via sessionStorage until browser tab closes
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    preferred_language?: 'en' | 'fil';
    tenantId?: string;
    tenantName?: string;
  };
  token: string;
  refreshToken?: string;
}

export interface TenantSelectionResponse {
  requires_tenant_selection: true;
  selection_token: string;
  tenants: Array<{ id: string; name: string; is_primary: boolean }>;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    preferred_language?: 'en' | 'fil';
  };
}

export type LoginResponse = AuthResponse | TenantSelectionResponse;

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  preferred_language?: 'en' | 'fil';
  created_at?: string;
  updated_at?: string;
}

const STORAGE_KEY = 'bmdc-auth-token';
const REFRESH_TOKEN_KEY = 'bmdc-refresh-token';
const SELECTION_TOKEN_KEY = 'bmdc-selection-token';

class AuthService {
  /**
   * Login user — returns either a full AuthResponse or a TenantSelectionResponse
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const apiResponse = await api.post<LoginResponse>('/auth/login', credentials);
    
    // API response structure: { success, data: LoginResponse, message }
    // Store token encrypted in sessionStorage if it's an AuthResponse (not tenant selection)
    if ('token' in apiResponse.data) {
      const authResponse = apiResponse.data as AuthResponse;
      await setEncryptedToken(STORAGE_KEY, authResponse.token);
      // Also store refresh token if provided
      if (authResponse.refreshToken) {
        await setEncryptedToken(REFRESH_TOKEN_KEY, authResponse.refreshToken);
      }
      api.clearCache();
    }
    
    return apiResponse.data;
  }

  /**
   * Select tenant after multi-tenant login prompt
   */
  async selectTenant(selectionToken: string, tenantId: string): Promise<AuthResponse> {
    const apiResponse = await api.post<AuthResponse>('/auth/select-tenant', {
      selection_token: selectionToken,
      tenant_id: tenantId,
    });
    
    // API response structure: { success, data: AuthResponse, message }
    // Store token encrypted in sessionStorage
    if (apiResponse.data.token) {
      const token = apiResponse.data.token;
      await setEncryptedToken(STORAGE_KEY, token);
      // Also store refresh token if provided
      if (apiResponse.data.refreshToken) {
        await setEncryptedToken(REFRESH_TOKEN_KEY, apiResponse.data.refreshToken);
      }
      api.clearCache();
    }
    
    return apiResponse.data;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    // Token is encrypted and stored in sessionStorage by authService.login() if needed
    return response.data;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Get refresh token from sessionStorage to send to backend for revocation
      const refreshToken = await getEncryptedToken(REFRESH_TOKEN_KEY);
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore errors — still clear client-side user cache
    } finally {
      // Clear all auth tokens from sessionStorage and drop any cached API responses
      clearAllEncryptedTokens([
        'bmdc-user',
        STORAGE_KEY,
        REFRESH_TOKEN_KEY,
        SELECTION_TOKEN_KEY,
      ]);
      api.clearCache();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  }

  /**
   * Update authenticated user's preferred language
   */
  async updatePreferredLanguage(
    preferred_language: 'en' | 'fil'
  ): Promise<{ id: string; preferred_language: 'en' | 'fil'; persisted?: boolean }> {
    const response = await api.patch<{ id: string; preferred_language: 'en' | 'fil'; persisted?: boolean }>(
      '/auth/me',
      { preferred_language },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  /**
   * Refresh authentication token — sends refresh token in body and stores new tokens
   */
  async refreshToken(): Promise<{ token: string; refreshToken: string }> {
    const refreshToken = await getEncryptedToken(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await api.post<{ token: string; refreshToken: string }>('/auth/refresh', {
      refreshToken,
    });
    
    // Store new tokens in sessionStorage
    if (response.data.token) {
      await setEncryptedToken(STORAGE_KEY, response.data.token);
    }
    if (response.data.refreshToken) {
      await setEncryptedToken(REFRESH_TOKEN_KEY, response.data.refreshToken);
    }
    
    return response.data;
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  }

  /**
   * Request password reset - sends OTP to email
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; expiresIn: number }> {
    const response = await api.post<{ success: boolean; message: string; expiresIn: number }>(
      '/auth/forgot-password',
      { email }
    );
    return (response as any)?.data?.success !== undefined ? (response as any).data : ((response as any)?.data ?? response);
  }

  /**
   * Verify password reset OTP - returns reset token
   */
  async verifyPasswordResetOTP(
    email: string,
    otp: string
  ): Promise<{ success: boolean; resetToken: string; expiresIn: number }> {
    const response = await api.post<{ success: boolean; resetToken: string; expiresIn: number }>(
      '/auth/verify-password-reset-otp',
      { email, otp }
    );
    return (response as any)?.data?.resetToken !== undefined ? (response as any).data : ((response as any)?.data ?? response);
  }

  /**
   * Complete password reset with new password
   */
  async resetPassword(params: {
    email: string;
    otp: string;
    newPassword: string;
    resetToken: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/reset-password',
      params
    );
    return (response as any)?.data?.success !== undefined ? (response as any).data : ((response as any)?.data ?? response);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    // Can no longer check the HttpOnly cookie from JS.
    // Use the presence of user profile data as a proxy.
    return !!sessionStorage.getItem('bmdc-user');
  }

  /**
   * Get stored token for Authorization header
   * Decrypts from sessionStorage on each access
   */
  async getToken(): Promise<string | null> {
    return await getEncryptedToken(STORAGE_KEY);
  }

  /**
   * Store selection token encrypted in sessionStorage (for multi-tenant flow)
   */
  async storeSelectionToken(token: string): Promise<void> {
    await setEncryptedToken(SELECTION_TOKEN_KEY, token);
  }

  /**
   * Retrieve selection token from encrypted sessionStorage
   */
  async getSelectionToken(): Promise<string | null> {
    return await getEncryptedToken(SELECTION_TOKEN_KEY);
  }

  /**
   * Clear selection token
   */
  clearSelectionToken(): void {
    removeEncryptedToken(SELECTION_TOKEN_KEY);
  }
}

export const authService = new AuthService();
export default authService;
