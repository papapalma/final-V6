import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, TenantSelectionRequired } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Eye, EyeOff, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '../utils/roles';
import { getFileUrl } from '../services/api';
import authService from '../services/authService';
import cmsSettingsService from '../services/cmsSettingsService';
import { verificationService } from '../services/verificationService';
import { OTPVerificationStep } from './auth/OTPVerificationStep';

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToSignup?: () => void;
  preFilledUsername?: string;  // NEW - optional pre-filled username from registration
}

interface CMSSettings {
  appearance: {
    logo: string;
    heroBackground: string;
  };
}

/** Determine the correct post-login route for a given role. */
function getDashboardRoute(role: UserRole | string): string {
  switch (role) {
    case 'super_admin':  return '/super-admin';
    case 'trainee':      return '/trainee/dashboard';
    default:             return '/dashboard';
  }
}

export default function LoginModal({ open, onOpenChange, onSwitchToSignup, preFilledUsername }: LoginModalProps) {
  const navigate = useNavigate();
  const { login, selectTenant, isAuthenticated, user } = useAuth();
  const [cmsSettings, setCmsSettings] = useState<CMSSettings | null>(null);

  // ── Credentials step ─────────────────────────────────────────────────────
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  // ── Forgot Password step ─────────────────────────────────────────────────
  const [forgotPasswordStep, setForgotPasswordStep] = useState(false);
  const [forgotEmail, setForgotEmail]               = useState('');
  const [forgotOTP, setForgotOTP]                   = useState('');
  const [resetToken, setResetToken]                 = useState('');
  const [newPassword, setNewPassword]               = useState('');
  const [confirmPassword, setConfirmPassword]       = useState('');
  const [showNewPassword, setShowNewPassword]       = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordStep1, setForgotPasswordStep1] = useState(true);  // Email entry
  const [forgotPasswordStep2, setForgotPasswordStep2] = useState(false); // OTP verification
  const [forgotPasswordStep3, setForgotPasswordStep3] = useState(false); // New password
  const [forgotOTPSent, setForgotOTPSent]           = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordResendCountdown, setForgotPasswordResendCountdown] = useState(0);
  const [canResendForgotPassword, setCanResendForgotPassword] = useState(true);

  // ── Tenant selection step ────────────────────────────────────────────────
  const [tenantStep, setTenantStep]         = useState(false);
  const [pendingSelection, setPendingSelection] =
    useState<TenantSelectionRequired | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectingTenant, setSelectingTenant]   = useState(false);

  // ── 2FA verification step ────────────────────────────────────────────────
  const [twoFAStep, setTwoFAStep]           = useState(false);
  const [twoFAEmail, setTwoFAEmail]         = useState('');
  const [codeSent, setCodeSent]             = useState(false);
  const [codeVerified, setCodeVerified]     = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyingCode, setVerifyingCode]   = useState(false);
  const [twoFAError, setTwoFAError]         = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [canResend, setCanResend]           = useState(true);
  const [loginResponse, setLoginResponse]   = useState<any>(null);

  // ── Calculate current step number ──────────────────────────────────────────
  // For multi-tenant: Step 1 (Credentials) → Step 2 (Tenant) → Step 3 (2FA)
  // For single-tenant: Step 1 (Credentials) → Step 2 (2FA)
  const isMultiTenantContext = tenantStep && pendingSelection;
  const totalSteps = isMultiTenantContext ? 3 : 2;
  const currentStep = twoFAStep ? totalSteps : (tenantStep ? 2 : 1);

  // Load CMS settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await cmsSettingsService.getSettings();
        if (data) {
          setCmsSettings(data as CMSSettings);
        }
      } catch (error) {
        console.error('Failed to load CMS settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Pre-fill username when modal opens with a pre-filled username from registration
  useEffect(() => {
    if (open && preFilledUsername) {
      setEmail(preFilledUsername);
      console.log('[LoginModal] Pre-filled username from registration', {
        username: preFilledUsername,
      });
    }
  }, [open, preFilledUsername]);

  // When already authenticated, close and go to the right dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      onOpenChange(false);
      // Check if there's a program_id from a shared link
      const programId = localStorage.getItem('selected_program_id');
      console.log('[LoginModal] Authenticated, programId from localStorage:', programId);

      if (programId) {
        // Redirect to program page with modal
        console.log('[LoginModal] Redirecting to program page:', programId);
        navigate(`/programs/${programId}/enroll`);
      } else {
        // Normal dashboard redirect
        navigate(getDashboardRoute(user.role));
      }
    }
  }, [isAuthenticated, user, navigate, onOpenChange]);

  // Cleanup countdown timer on unmount or when 2FA step changes
  useEffect(() => {
    if (!twoFAStep || canResend) {
      return; // No timer running
    }

    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [twoFAStep, canResend]);

  // Forgot password countdown timer
  useEffect(() => {
    if (!forgotPasswordStep || !forgotPasswordStep2 || canResendForgotPassword) {
      return;
    }

    const timer = setInterval(() => {
      setForgotPasswordResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResendForgotPassword(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [forgotPasswordStep, forgotPasswordStep2, canResendForgotPassword]);

  const resetState = () => {
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setTenantStep(false);
    setPendingSelection(null);
    setSelectedTenantId('');
    // Reset 2FA state
    setTwoFAStep(false);
    setTwoFAEmail('');
    setCodeSent(false);
    setCodeVerified(false);
    setVerificationCode('');
    setVerifyingCode(false);
    setTwoFAError(null);
    setResendCountdown(0);
    setCanResend(true);
    setLoginResponse(null);
    // Reset forgot password state
    setForgotPasswordStep(false);
    setForgotPasswordStep1(true);
    setForgotPasswordStep2(false);
    setForgotPasswordStep3(false);
    setForgotEmail('');
    setForgotOTP('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotOTPSent(false);
    setForgotPasswordError(null);
    setForgotPasswordResendCountdown(0);
    setCanResendForgotPassword(true);
  };

  // ── Step 1: credential submit ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result === false) {
        toast.error('Invalid email or password');
        return;
      }

      // Multi-tenant selection required
      if (typeof result === 'object' && 'requiresTenantSelection' in result && result.requiresTenantSelection) {
        setPendingSelection(result as TenantSelectionRequired);
        setSelectedTenantId(
          result.tenants.find((t) => t.is_primary)?.id ?? result.tenants[0]?.id ?? ''
        );
        setTenantStep(true);
        return;
      }

      // Single-tenant login successful (result === true)
      // Complete login immediately (no 2FA required)
      await handleLoginSuccess(email);
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1.5: Login success handler - skip 2FA ────────────────────
  const handleLoginSuccess = async (userEmail: string, isVerified?: boolean, userRole?: string) => {
    // Email verification is only required during signup, not during login
    // Complete login immediately without any 2FA/verification step
    onOpenChange(false);
    resetState();
    return;
  };

  // ── Step 2: tenant select submit ──────────────────────────────────────────
  const handleSelectTenant = async () => {
    if (!pendingSelection || !selectedTenantId) return;
    setSelectingTenant(true);

    try {
      const ok = await selectTenant(pendingSelection.selectionToken, selectedTenantId);
      if (ok) {
        // Tenant selected successfully - complete login (no 2FA required)
        onOpenChange(false);
        resetState();
      } else {
        toast.error('Tenant selection failed. Please log in again.');
        resetState();
      }
    } catch {
      toast.error('An error occurred. Please try again.');
      resetState();
    } finally {
      setSelectingTenant(false);
    }
  };

  // ── Step 3: 2FA - Send code ──────────────────────────────────────────────────
  const handleSend2FACode = async (userEmail: string) => {
    try {
      setCodeSent(false);
      setTwoFAError(null);
      
      // Call verification service to send OTP
      const response = await verificationService.sendVerificationCode({
        email: userEmail,
        method: 'email',
      });

      if (response.success) {
        setCodeSent(true);
        toast.success(`Code sent to ${userEmail}`);
      } else {
        setTwoFAError(response.message || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Error sending 2FA code:', error);
      setTwoFAError('Failed to send code. Please try again.');
    }
  };

  // ── Step 3: 2FA - Resend code with countdown ─────────────────────────────────
  const handleResend2FACode = async () => {
    if (!canResend) return;

    try {
      setTwoFAError(null);
      setCanResend(false);
      setResendCountdown(60);

      // Call verification service to resend OTP
      const response = await verificationService.sendVerificationCode({
        email: twoFAEmail,
        method: 'email',
      });

      if (response.success) {
        toast.success('Code resent successfully');
        
        // Start countdown timer
        const timer = setInterval(() => {
          setResendCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setCanResend(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Cleanup timer on unmount
        return () => clearInterval(timer);
      } else {
        setTwoFAError(response.message || 'Failed to resend code');
        setCanResend(true);
      }
    } catch (error) {
      console.error('Error resending 2FA code:', error);
      setTwoFAError('Failed to resend code. Please try again.');
      setCanResend(true);
    }
  };

  // ── Step 3: 2FA - Verify code ────────────────────────────────────────────────
  const handleVerify2FACode = async (code: string) => {
    try {
      setVerifyingCode(true);
      setTwoFAError(null);

      // Call verification service to verify OTP
      const response = await verificationService.verifyCode(twoFAEmail, code);

      if (response.success) {
        setCodeVerified(true);
        toast.success('Email verified successfully!');
        
        // Close modal and navigate to dashboard
        setTimeout(() => {
          onOpenChange(false);
          // Navigation handled by isAuthenticated useEffect
        }, 500);
      } else {
        setTwoFAError(response.message || 'Invalid verification code');
        setVerificationCode('');
      }
    } catch (error) {
      console.error('Error verifying 2FA code:', error);
      setTwoFAError('Verification failed. Please try again.');
      setVerificationCode('');
    } finally {
      setVerifyingCode(false);
    }
  };

  // ── Forgot Password - Step 1: Send OTP ───────────────────────────────────────
  const handleForgotPasswordRequest = async () => {
    setForgotPasswordError(null);
    setForgotPasswordLoading(true);

    try {
      const result = await authService.requestPasswordReset(forgotEmail);
      if (result.success) {
        setForgotOTPSent(true);
        setForgotPasswordStep1(false);
        setForgotPasswordStep2(true);
        toast.success('Reset code sent to your email');
        setCanResendForgotPassword(false);
        setForgotPasswordResendCountdown(60);
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to send reset code. Please try again.';
      setForgotPasswordError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // ── Forgot Password - Step 2: Verify OTP ─────────────────────────────────────
  const handleForgotPasswordVerifyOTP = async () => {
    setForgotPasswordError(null);
    setForgotPasswordLoading(true);

    try {
      const result = await authService.verifyPasswordResetOTP(forgotEmail, forgotOTP);
      if (result.success) {
        setResetToken(result.resetToken);
        setForgotPasswordStep2(false);
        setForgotPasswordStep3(true);
        toast.success('OTP verified successfully');
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Invalid OTP. Please try again.';
      setForgotPasswordError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // ── Forgot Password - Step 3: Reset Password ─────────────────────────────────
  const handleForgotPasswordComplete = async () => {
    setForgotPasswordError(null);

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setForgotPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 10) {
      setForgotPasswordError('Password must be at least 10 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setForgotPasswordError('Password must contain uppercase, lowercase, and numbers');
      return;
    }

    setForgotPasswordLoading(true);

    try {
      const result = await authService.resetPassword({
        email: forgotEmail,
        otp: forgotOTP,
        newPassword,
        resetToken,
      });

      if (result.success) {
        toast.success('Password reset successfully! You can now log in with your new password.');
        resetState();
        setForgotPasswordStep(false);
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to reset password. Please try again.';
      setForgotPasswordError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // ── Forgot Password - Resend OTP ─────────────────────────────────────────────
  const handleForgotPasswordResendOTP = async () => {
    if (!canResendForgotPassword) return;

    setCanResendForgotPassword(false);
    setForgotPasswordResendCountdown(60);
    setForgotPasswordError(null);

    try {
      await authService.requestPasswordReset(forgotEmail);
      toast.success('Reset code resent to your email');
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to resend code. Please try again.';
      setForgotPasswordError(errorMsg);
      setCanResendForgotPassword(true);
      setForgotPasswordResendCountdown(0);
      toast.error(errorMsg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent 
        className="max-w-md max-h-[88vh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0"
        style={{ 
          width: 'calc(100% - 2rem)',
          maxWidth: '28rem'
        }}
      >

        {/* ── 2FA verification step ── */}
        {twoFAStep ? (
          <>
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <div className="mx-auto mb-3 sm:mb-4 flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                <span className="text-2xl text-primary-foreground">🔐</span>
              </div>
              <div className="text-center text-sm font-medium text-muted-foreground mb-2">
                Step {currentStep} of {totalSteps}
              </div>
              <DialogTitle className="text-center">Email Verification</DialogTitle>
              <DialogDescription className="text-center">
                This is the final step to secure your account
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
              <OTPVerificationStep
                title="Email Verification"
                description="Enter the 6-digit code sent to your email"
                recipientEmail={twoFAEmail}
                codeSent={codeSent}
                codeVerified={codeVerified}
                verificationCode={verificationCode}
                loading={verifyingCode}
                verifying={verifyingCode}
                error={twoFAError || undefined}
                canResend={canResend}
                resendCountdown={resendCountdown}
                onSendCode={() => handleSend2FACode(twoFAEmail)}
                onVerifyCode={(code) => handleVerify2FACode(code)}
                onResendCode={handleResend2FACode}
                onBack={resetState}
                showMethodSelection={false}
              />
            </div>
          </>
        ) : tenantStep && pendingSelection ? (
          /* ── Tenant selection step ── */
          <>
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <div className="mx-auto mb-3 sm:mb-4 flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                <Building2 className="size-8 text-primary-foreground" />
              </div>
              <div className="text-center text-sm font-medium text-muted-foreground mb-2">
                Step 2 of 3
              </div>
              <DialogTitle className="text-center">Select Organization</DialogTitle>
              <DialogDescription className="text-center">
                Your account belongs to multiple organizations. Choose one to continue.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <div className="space-y-2">
                {pendingSelection.tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedTenantId === tenant.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tenant.name}</span>
                      {tenant.is_primary && (
                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t px-4 sm:px-6 py-3 sm:py-4 bg-muted/30">
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetState}
                disabled={selectingTenant}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleSelectTenant}
                disabled={!selectedTenantId || selectingTenant}
              >
                {selectingTenant ? 'Signing in...' : 'Continue'}
              </Button>
            </div>
          </>
        ) : forgotPasswordStep ? (
          /* ── Forgot Password Flow ── */
          <>
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 shadow-lg">
                <span className="text-2xl">🔐</span>
              </div>
              <DialogTitle className="text-center">Reset Your Password</DialogTitle>
              <DialogDescription className="text-center">
                {forgotPasswordStep1 && "We'll send a reset code to your email"}
                {forgotPasswordStep2 && "Enter the code from your email"}
                {forgotPasswordStep3 && "Create a strong new password"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
              {forgotPasswordStep1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="bg-input-background"
                    />
                  </div>
                  {forgotPasswordError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <p className="text-sm text-destructive">{forgotPasswordError}</p>
                    </div>
                  )}
                </div>
              )}

              {forgotPasswordStep2 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="forgot-otp" className="text-sm font-medium">Enter 6-Digit Code</Label>
                    <p className="text-xs text-muted-foreground">Check your email for the verification code</p>
                    <Input
                      id="forgot-otp"
                      type="text"
                      placeholder="• • • • • •"
                      value={forgotOTP}
                      onChange={(e) => setForgotOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      required
                      className="bg-input-background text-center text-3xl font-bold tracking-[0.5rem] letter-spacing py-4"
                    />
                  </div>
                  {forgotPasswordError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <p className="text-sm text-destructive">{forgotPasswordError}</p>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-center text-muted-foreground">
                      Didn't receive the code?
                    </p>
                    <button
                      type="button"
                      onClick={handleForgotPasswordResendOTP}
                      disabled={!canResendForgotPassword || forgotPasswordLoading}
                      className="text-sm font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline transition-colors"
                    >
                      {canResendForgotPassword ? '↻ Resend Code' : `Resend in ${forgotPasswordResendCountdown}s`}
                    </button>
                  </div>
                </div>
              )}

              {forgotPasswordStep3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="bg-input-background pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="bg-input-background pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Password requirements:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• At least 10 characters</li>
                      <li>• 1 uppercase letter (A-Z)</li>
                      <li>• 1 lowercase letter (a-z)</li>
                      <li>• 1 number (0-9)</li>
                    </ul>
                  </div>

                  {forgotPasswordError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <p className="text-sm text-destructive">{forgotPasswordError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t px-4 sm:px-6 py-3 sm:py-4 bg-muted/30">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (forgotPasswordStep2) {
                    setForgotPasswordStep2(false);
                    setForgotPasswordStep1(true);
                    setForgotOTP('');
                  } else if (forgotPasswordStep3) {
                    setForgotPasswordStep3(false);
                    setForgotPasswordStep2(true);
                    setNewPassword('');
                    setConfirmPassword('');
                  } else {
                    setForgotPasswordStep(false);
                  }
                }}
                disabled={forgotPasswordLoading}
              >
                ← Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (forgotPasswordStep1) {
                    handleForgotPasswordRequest();
                  } else if (forgotPasswordStep2) {
                    handleForgotPasswordVerifyOTP();
                  } else if (forgotPasswordStep3) {
                    handleForgotPasswordComplete();
                  }
                }}
                disabled={forgotPasswordLoading || !forgotEmail || (forgotPasswordStep2 && !forgotOTP) || (forgotPasswordStep3 && (!newPassword || !confirmPassword))}
              >
                {forgotPasswordLoading ? 'Processing...' : 'Continue'}
              </Button>
            </div>
          </>
        ) : (
          /* ── Credentials step ── */
          <>
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <div className="mx-auto mb-3 sm:mb-4 flex size-14 sm:size-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                {cmsSettings?.appearance?.logo ? (
                  <img 
                    src={getFileUrl(cmsSettings.appearance.logo)} 
                    alt="Logo" 
                    className="size-14 rounded-xl object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-2xl text-primary-foreground">BMDC</span>
                )}
              </div>
              <div className="text-center text-sm font-medium text-muted-foreground mb-2">
                Step 1 of {totalSteps}
              </div>
              <DialogTitle className="text-center">Welcome Back</DialogTitle>
              <DialogDescription className="text-center">
                Sign in to your account to continue
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6">
                <div className="space-y-3 sm:space-y-4 pb-4 sm:pb-6">
                  {preFilledUsername && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 mb-4">
                      <p className="text-sm text-green-800">
                        ✓ Registration successful! Please log in with your credentials.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-input-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-input-background pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t px-4 sm:px-6 py-3 sm:py-4 bg-muted/30">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="space-y-2 text-center text-sm">
                  <div className="text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setForgotPasswordStep(true)}
                      className="text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="text-muted-foreground">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        resetState();
                        onOpenChange(false);
                        onSwitchToSignup?.();
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      Sign up
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
