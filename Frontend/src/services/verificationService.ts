import { apiClient } from './api';

export interface SendCodeResponse {
  success: boolean;
  message: string;
  code?: string; // Only in development
}

export interface VerifyCodeResponse {
  success: boolean;
  message: string;
}

export interface CheckStatusResponse {
  email: string;
  isVerified: boolean;
}

class VerificationService {
  /**
   * Send verification code via email and/or WhatsApp
   */
  async sendVerificationCode(params: {
    email: string;
    phone?: string;
    method: 'email' | 'whatsapp' | 'both';
    firstName?: string;
    registrationContext?: boolean;
  }): Promise<SendCodeResponse> {
    const response = await apiClient.post<SendCodeResponse>(
      '/verification/send-code',
      params
    );
    return response.data;
  }

  /**
   * Verify the OTP code
   */
  async verifyCode(email: string, code: string): Promise<VerifyCodeResponse> {
    const response = await apiClient.post<VerifyCodeResponse>(
      '/verification/verify-code',
      { email, code }
    );
    return response.data;
  }

  /**
   * Check if email is verified
   */
  async checkVerificationStatus(email: string): Promise<CheckStatusResponse> {
    const response = await apiClient.post<CheckStatusResponse>(
      '/verification/check-status',
      { email }
    );
    return response.data;
  }
}

export const verificationService = new VerificationService();

