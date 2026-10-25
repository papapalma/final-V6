import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import {
  User, Lock, MapPin, GraduationCap, Building2,
  BookOpen, CheckCircle2, ChevronRight, ChevronLeft,
  Calendar, Users, Mail, Loader, AlertCircle, FileText
} from 'lucide-react';
import { OTPInput } from './auth/OTPInput';
import { RequirementDropZone } from './RequirementDropZone';
import registrationService, { SubmitRegistrationData } from '../services/registrationService';
import programService from '../services/programService';
import { verificationService } from '../services/verificationService';
import tenantService, { Tenant } from '../services/tenantService';
import api from '../services/api';
import logger from '../utils/logger';
import { useRequirementDefinitions } from '../hooks/useRequirementDefinitions';
import type { RequirementDefinition } from '../types/requirementDefinition';

interface Program {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  max_trainees?: number;
}

interface RegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistrationComplete?: (username: string) => void;
}

const STEPS = [
  { id: 1, title: 'Account', icon: Lock, description: 'Set up your login credentials' },
  { id: 2, title: 'Personal', icon: User, description: 'Basic personal information' },
  { id: 3, title: 'Address', icon: MapPin, description: 'Your current address' },
  { id: 4, title: 'Background', icon: GraduationCap, description: 'Education & employment' },
  { id: 5, title: 'Tenant', icon: Building2, description: 'Select your organization' },
  { id: 6, title: 'Requirements', icon: FileText, description: 'Training requirements' },
  { id: 7, title: 'Program', icon: BookOpen, description: 'Choose your program' },
  { id: 8, title: 'Verify', icon: Mail, description: 'Verify your email' },
];

type FormData = SubmitRegistrationData & { confirm_password: string; phone: string; tenant_id: string };

const EMPTY_FORM: FormData = {
  username: '', email: '', password: '', confirm_password: '',
  first_name: '', last_name: '', middle_name: '', phone: '',
  sex: 'Male', birth_date: '', birth_place: '', civil_status: 'Single',
  province: '', municipality: '', barangay: '', street: '',
  educational_attainment: '', course: '', year_graduated: '', classification: '',
  disability: '', employment_status: '', program_id: '', tenant_id: '',
};

// Helper function to mask email (first 3 chars + dots + domain)
const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 3)}...@${domain}`;
};

export default function RegistrationModal({ 
  open, 
  onOpenChange,
  onRegistrationComplete
}: RegistrationModalProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Step 5: Tenant Selection state variables
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);
  
  // Step 6: Requirements state variables
  // Note: We'll fetch requirements from a public endpoint with the selected tenant_id
  const [requirementDefinitions, setRequirementDefinitions] = useState<RequirementDefinition[]>([]);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
    // Step 6: Requirements file uploads
  const [requirementFiles, setRequirementFiles] = useState<Record<string, File | null>>({
  });

  // Fetch requirements when tenant is selected
  useEffect(() => {
    if (form.tenant_id && step === 6) {
      fetchRequirements(form.tenant_id);
    }
  }, [form.tenant_id, step]);

  const fetchRequirements = async (tenantId: string) => {
    setLoadingRequirements(true);
    setRequirementsError(null);
    try {
      const response = await api.get('/requirement-definitions', {
        public: 'true',
        tenant_id: tenantId,
        is_active: 'true',
        limit: 100
      });
      const data = response?.data || response;
      setRequirementDefinitions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setRequirementsError(error.message || 'Failed to load requirements');
      setRequirementDefinitions([]);
    } finally {
      setLoadingRequirements(false);
    }
  };
  
  // Step 6 OTP state variables (Task 4.2)
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  
  // Legacy verification states (kept for backward compatibility)
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  useEffect(() => {
    if (open) {
      loadPrograms();
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setForm(EMPTY_FORM);
      setErrors({});
      setSubmitted(false);
      setVerificationCode('');
      setCodeVerified(false);
      setCodeSent(false);
      setVerificationError('');
      // Reset OTP state
      setOtpValue('');
      setOtpError(null);
      setIsVerifying(false);
      setIsVerified(false);
      setResendCountdown(0);
      setCanResend(true);
    }
  }, [open]);

  // Load tenants when Step 5 is displayed (Task 4.2)
  useEffect(() => {
    if (open && step === 5) {
      loadTenants();
    }
  }, [open, step]);

  // Refresh programs when tenant is selected (Task 4.4)
  // Trigger loadPrograms with selected tenant_id when step === 5
  useEffect(() => {
    if (step === 5 && form.tenant_id) {
      loadPrograms(form.tenant_id);
    }
  }, [step, form.tenant_id]);

  // Countdown timer for resend button (Task 4.2)
  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown]);

  const loadPrograms = async (tenantId?: string) => {
    try {
      const filters: any = { status: 'active' };
      if (tenantId) {
        filters.tenant_id = tenantId;
      }
      const data = await programService.getPrograms(filters);
      setPrograms(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch {
      toast.error('Failed to load programs');
    } finally {
      setLoadingPrograms(false);
    }
  };

  const loadTenants = async () => {
    setLoadingTenants(true);
    setTenantError(null);
    try {
      const data = await tenantService.getActiveTenants();
      setTenants(data);
    } catch (error: any) {
      setTenantError(error?.message || 'Failed to load organizations');
      toast.error('Failed to load organizations');
    } finally {
      setLoadingTenants(false);
    }
  };

  // Load tenants when Step 5 is displayed
  useEffect(() => {
    if (open && step === 5) {
      loadTenants();
    }
  }, [open, step]);

  const handleSendVerificationCode = async () => {
    setVerificationError('');
    setSendingCode(true);
    setOtpError(null);
    try {
      await verificationService.sendVerificationCode({
        email: form.email,
        phone: form.phone,
        method: 'email',
        firstName: form.first_name,
        registrationContext: true
      });
      setCodeSent(true);
      // Start countdown for resend button
      setResendCountdown(60);
      setCanResend(false);
      setOtpValue('');
      setOtpError(null);
      toast.success('Verification code sent via email!');
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to send verification code';
      setVerificationError(errorMsg);
      setOtpError(errorMsg);
      toast.error('Failed to send verification code');
    } finally {
      setSendingCode(false);
    }
  };

  /**
   * Task 4.6: Handle manual "Verify Code" button click
   * - Validates code is 6 digits
   * - Calls same verification logic as handleOTPComplete
   * - Button disabled when otpValue.length < 6
   */
  const handleVerifyCode = async () => {
    // Validate code is 6 digits
    if (!otpValue || otpValue.length !== 6) {
      setOtpError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setOtpError(null);
    try {
      await verificationService.verifyCode(form.email, otpValue);
      setIsVerified(true);
      setCodeVerified(true);
      toast.success('Email verified successfully!');

    } catch (error: any) {
      const errorMsg = error?.message || 'Invalid verification code';
      
      // Check if code is expired
      if (error?.response?.status === 410 || errorMsg.includes('expired')) {
        setOtpError('Code expired. Please request a new code.');
      } else {
        setOtpError(errorMsg);
      }
      
      // Keep the OTP value so user can retry
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Task 4.5: Handle OTP completion (when user enters all 6 digits)
   * - Validates code length
   * - Calls verification API
   * - Sets isVerified on success
   * - Keeps digits displayed on error for easy retry
   */
  const handleOTPComplete = async (code: string) => {
    // Validate code length
    if (!code || code.length !== 6) {
      setOtpError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setOtpError(null);
    try {
      await verificationService.verifyCode(form.email, code);
      setIsVerified(true);
      setCodeVerified(true);
      toast.success('Email verified successfully!');

    } catch (error: any) {
      const errorMsg = error?.message || 'Invalid verification code';
      
      // Check if code is expired
      if (error?.response?.status === 410 || errorMsg.includes('expired')) {
        setOtpError('Code expired. Please request a new code.');
      } else {
        setOtpError(errorMsg);
      }
      
      // Keep the OTP value so user can retry
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Task 4.7: Handle resend code with 60-second countdown
   * - Sets canResend = false
   * - Starts countdown: resendCountdown = 60
   * - Calls OTP resend API
   * - On success: clear otpValue, reset focus, show message
   * - On failure: show error, keep resend available
   * - Display countdown on button: "Resend in Xs"
   * - When countdown = 0: set canResend = true, display "Resend Code"
   */
  const handleResendCode = async () => {
    setCanResend(false);
    setResendCountdown(60);
    setOtpError(null);
    setSendingCode(true);
    
    try {
      await verificationService.sendVerificationCode({
        email: form.email,
        phone: form.phone,
        method: 'email',
        firstName: form.first_name,
        registrationContext: true
      });
      
      // Clear OTP input and reset focus
      setOtpValue('');
      
      // Focus will be automatically managed by OTPInput autoFocus prop
      toast.success('New code sent to your email!');
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to resend code';
      setOtpError(errorMsg);
      setCanResend(true); // Keep resend available on error
      setResendCountdown(0);
      toast.error(errorMsg);
    } finally {
      setSendingCode(false);
    }
  };

  const set = (field: keyof FormData, value: string) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // When tenant is changed, clear program selection
      if (field === 'tenant_id' && value !== prev.tenant_id) {
        updated.program_id = '';
      }
      return updated;
    });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep = (s: number): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (s === 1) {
      if (!form.username.trim()) errs.username = 'Username is required';
      else if (form.username.length < 3) errs.username = 'Must be at least 3 characters';
      else if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) errs.username = 'Letters, numbers, - and _ only';
      if (!form.email.trim()) errs.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
      if (!form.password) errs.password = 'Password is required';
      else if (form.password.length < 6) errs.password = 'At least 6 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) errs.password = 'Needs uppercase, lowercase and number';
      if (!form.confirm_password) errs.confirm_password = 'Please confirm your password';
      else if (form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match';
    }

    if (s === 2) {
      if (!form.first_name.trim()) errs.first_name = 'First name is required';
      if (!form.last_name.trim()) errs.last_name = 'Last name is required';
      if (!form.phone.trim()) errs.phone = 'Phone number is required';
      else if (!/^[0-9+\-\s()]+$/.test(form.phone) || form.phone.trim().length < 10) errs.phone = 'Enter a valid phone number';
      if (!form.sex) errs.sex = 'Sex is required';
      if (!form.birth_date) errs.birth_date = 'Birth date is required';
      if (!form.birth_place.trim()) errs.birth_place = 'Birth place is required';
      if (!form.civil_status) errs.civil_status = 'Civil status is required';
    }

    if (s === 3) {
      if (!form.province.trim()) errs.province = 'Province is required';
      if (!form.municipality.trim()) errs.municipality = 'Municipality is required';
      if (!form.barangay.trim()) errs.barangay = 'Barangay is required';
      if (!form.street.trim()) errs.street = 'Street/sitio is required';
    }

    if (s === 4) {
      if (!form.educational_attainment) errs.educational_attainment = 'Required';
      if (!form.course.trim()) errs.course = 'Course/field of study is required';
      if (!form.year_graduated.trim()) errs.year_graduated = 'Year is required';
      else if (!/^\d{4}$/.test(form.year_graduated)) errs.year_graduated = 'Enter a valid 4-digit year';
      if (!form.classification) errs.classification = 'Classification is required';
      if (!form.employment_status) errs.employment_status = 'Employment status is required';
    }

    if (s === 5) {
      if (!form.tenant_id) errs.tenant_id = 'Please select an organization';
    }

    if (s === 6) {
      const requiredFiles = requirementDefinitions
        .filter((requirement) => requirement.is_mandatory)
        .map((requirement) => requirement.requirement_type);
      const allRequiredFilesPresent = requiredFiles.every(
        (fileKey) => requirementFiles[fileKey] !== null && requirementFiles[fileKey] !== undefined
      );

      if (!allRequiredFilesPresent) {
        setRequirementsError('Please upload all required documents to proceed');
        return false;
      }
      setRequirementsError(null);
    }

    if (s === 7) {
      if (!form.program_id) errs.program_id = 'Please select a program';
    }

    if (s === 8) {
      // Task 8.1: Check isVerified === true before allowing progression
      if (!isVerified) {
        setOtpError('Please verify your email first');
        errs.email = 'Email verification required'; // Add to errors to prevent navigation
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validateStep(step)) {
      // When moving from Step 5 to Step 6, load programs filtered by selected tenant
      if (step === 5 && form.tenant_id) {
        loadPrograms(form.tenant_id);
      }
      setStep(s => s + 1);
    }
  };

  const back = () => {
    setErrors({});
    // Task 8.2: When navigating back from Step 8
    if (step === 8) {
      // Clear OTP state but preserve Steps 1-6 data
      setOtpValue('');
      setOtpError(null);
      setIsVerifying(false);
      // Don't reset isVerified yet, will be reset on next navigation
      setResendCountdown(0);
      setCanResend(true);
    }
    setStep(s => s - 1);
  };

  const uploadRequirementFiles = async (traineeId: string): Promise<void> => {
    for (const [key, file] of Object.entries(requirementFiles)) {
      if (file) {
        try {
          const formDataToSend = new FormData();
          formDataToSend.append('file', file);
          formDataToSend.append('requirement_type', key);
          
          await api.post(`/trainees/${traineeId}/requirements`, formDataToSend);
          logger.info('Uploaded requirement file:', { traineeId, fileName: file.name });
        } catch (error) {
          logger.error('Failed to upload requirement file:', { error });
          toast.warning(`Could not upload ${file.name}, but registration was saved`);
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) {
      setStep(6);
      toast.error('Please upload all required documents before submitting');
      return;
    }
    setSubmitting(true);
    try {
      const { confirm_password, ...data } = form;
      const regResponse = await registrationService.submitRegistration({
        ...data,
        disability: data.disability?.trim() || null,
      });

      const traineeId = (regResponse as any)?.id || (regResponse as any)?.data?.id;
      if (traineeId && Object.keys(requirementFiles).length > 0) {
        await uploadRequirementFiles(traineeId);
      }

      setSubmitted(true);
      
      // Call the parent callback to transition to login modal
      if (onRegistrationComplete) {
        setTimeout(() => {
          onRegistrationComplete(form.username);
        }, 500);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (field: keyof FormData) =>
    errors[field] ? 'border-destructive focus-visible:ring-destructive' : '';

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="size-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Registration Submitted!</h2>
            <p className="mb-6 text-muted-foreground">
              Your registration is now pending review by our staff. You will be able to log in once your account is approved.
            </p>
            <div className="mb-6 w-full space-y-1 rounded-lg bg-muted p-4 text-left text-sm">
              <p><span className="font-medium">Name:</span> {form.first_name} {form.last_name}</p>
              <p><span className="font-medium">Email:</span> {form.email}</p>
              <p><span className="font-medium">Username:</span> {form.username}</p>
              <p><span className="font-medium">Program:</span> {programs.find(p => p.id === form.program_id)?.name}</p>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="size-5 text-primary" />; })()}
            {STEPS[step - 1].title}
          </DialogTitle>
          <DialogDescription>{STEPS[step - 1].description}</DialogDescription>
        </DialogHeader>

        {/* Step progress */}
        <div className="mb-4 flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex size-8 items-center justify-center rounded-full border-2 transition-all ${
                    done ? 'border-primary bg-primary text-primary-foreground'
                    : active ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground/50'
                  }`}>
                    {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <span className={`mt-1 hidden text-[10px] font-medium sm:block ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-1 h-0.5 flex-1 transition-all ${done ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {/* STEP 1 – Account Credentials */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input id="username" value={form.username} onChange={e => set('username', e.target.value)}
                  placeholder="e.g. juan_dela_cruz" className={fieldClass('username')} />
                {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="you@email.com" className={fieldClass('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input id="password" type="password" value={form.password} onChange={e => set('password', e.target.value)}
                    placeholder="••••••••" className={fieldClass('password')} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password *</Label>
                  <Input id="confirm_password" type="password" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)}
                    placeholder="••••••••" className={fieldClass('confirm_password')} />
                  {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password}</p>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters and include uppercase, lowercase, and a number.
              </p>
            </>
          )}

          {/* STEP 2 – Personal Info */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                    placeholder="Juan" className={fieldClass('first_name')} />
                  {errors.first_name && <p className="text-xs text-destructive">{errors.first_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                    placeholder="Dela Cruz" className={fieldClass('last_name')} />
                  {errors.last_name && <p className="text-xs text-destructive">{errors.last_name}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Santos" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="09XX-XXX-XXXX" className={fieldClass('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sex *</Label>
                  <Select value={form.sex} onValueChange={(v: string) => set('sex', v)}>
                    <SelectTrigger className={fieldClass('sex')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Civil Status *</Label>
                  <Select value={form.civil_status} onValueChange={(v: string) => set('civil_status', v)}>
                    <SelectTrigger className={fieldClass('civil_status')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Single', 'Married', 'Widowed', 'Separated'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Birth Date *</Label>
                  <Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)}
                    className={fieldClass('birth_date')} />
                  {errors.birth_date && <p className="text-xs text-destructive">{errors.birth_date}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Birth Place *</Label>
                  <Input value={form.birth_place} onChange={e => set('birth_place', e.target.value)}
                    placeholder="City/Municipality" className={fieldClass('birth_place')} />
                  {errors.birth_place && <p className="text-xs text-destructive">{errors.birth_place}</p>}
                </div>
              </div>
            </>
          )}

          {/* STEP 3 – Address */}
          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Province *</Label>
                  <Input value={form.province} onChange={e => set('province', e.target.value)}
                    placeholder="e.g. Laguna" className={fieldClass('province')} />
                  {errors.province && <p className="text-xs text-destructive">{errors.province}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Municipality/City *</Label>
                  <Input value={form.municipality} onChange={e => set('municipality', e.target.value)}
                    placeholder="e.g. Calamba" className={fieldClass('municipality')} />
                  {errors.municipality && <p className="text-xs text-destructive">{errors.municipality}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Barangay *</Label>
                  <Input value={form.barangay} onChange={e => set('barangay', e.target.value)}
                    placeholder="e.g. Brgy. Uno" className={fieldClass('barangay')} />
                  {errors.barangay && <p className="text-xs text-destructive">{errors.barangay}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Street / Sitio / Purok *</Label>
                  <Input value={form.street} onChange={e => set('street', e.target.value)}
                    placeholder="House No. / Street Name" className={fieldClass('street')} />
                  {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
                </div>
              </div>
            </>
          )}

          {/* STEP 4 – Background */}
          {step === 4 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Educational Attainment *</Label>
                  <Select value={form.educational_attainment} onValueChange={(v: string) => set('educational_attainment', v)}>
                    <SelectTrigger className={fieldClass('educational_attainment')}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Elementary', 'High School', 'Senior High School', 'Vocational', 'College', 'Post Graduate'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.educational_attainment && <p className="text-xs text-destructive">{errors.educational_attainment}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Year Graduated *</Label>
                  <Input value={form.year_graduated} onChange={e => set('year_graduated', e.target.value)}
                    placeholder="2024" maxLength={4} className={fieldClass('year_graduated')} />
                  {errors.year_graduated && <p className="text-xs text-destructive">{errors.year_graduated}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Course / Degree / Field of Study *</Label>
                <Input value={form.course} onChange={e => set('course', e.target.value)}
                  placeholder="e.g. BSIT, Senior High School - TVL" className={fieldClass('course')} />
                {errors.course && <p className="text-xs text-destructive">{errors.course}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Classification *</Label>
                  <Select value={form.classification} onValueChange={(v: string) => set('classification', v)}>
                    <SelectTrigger className={fieldClass('classification')}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Out-of-School Youth', 'Student', 'Unemployed', 'Underemployed', '4Ps Beneficiary'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.classification && <p className="text-xs text-destructive">{errors.classification}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Employment Status *</Label>
                  <Select value={form.employment_status} onValueChange={(v: string) => set('employment_status', v)}>
                    <SelectTrigger className={fieldClass('employment_status')}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Employed', 'Unemployed', 'Self-employed', 'Student'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.employment_status && <p className="text-xs text-destructive">{errors.employment_status}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Disability (if any)</Label>
                <Input value={form.disability || ''} onChange={e => set('disability', e.target.value)}
                  placeholder="Leave blank if none" />
              </div>
            </>
          )}

          {/* STEP 5 – Tenant Selection */}
          {step === 5 && (
            <>
              <p className="text-sm text-muted-foreground">Select your organization:</p>
              {loadingTenants ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                </div>
              ) : tenants.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 size-8 opacity-40" />
                  <p>No organizations available.</p>
                </div>
              ) : tenantError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                    <AlertCircle className="size-4 flex-shrink-0" />
                    <span className="text-sm">{tenantError}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {tenants.map(tenant => (
                    <button
                      key={tenant.id}
                      type="button"
                      onClick={() => set('tenant_id', tenant.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-all ${
                        form.tenant_id === tenant.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold">{tenant.name}</p>
                          {tenant.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tenant.description}</p>
                          )}
                        </div>
                        <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          form.tenant_id === tenant.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {form.tenant_id === tenant.id && <div className="size-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id}</p>}
            </>
          )}

                    {/* STEP 6 – Requirements */}
          {step === 6 && (
            <>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-3">Training Requirements</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Drag files here or click to browse. All 6 required documents must be uploaded.
                  </p>
                </div>

                <div className="space-y-3">
                  {loadingRequirements ? (
                    <p className="text-sm text-muted-foreground">Loading requirements...</p>
                  ) : requirementsError ? (
                    <p className="text-sm text-destructive">{requirementsError}</p>
                  ) : requirementDefinitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active requirements are configured for this organization.</p>
                  ) : (
                    requirementDefinitions.map((requirement) => (
                      <RequirementDropZone
                        key={requirement.id}
                        title={requirement.display_name}
                        description={requirement.description}
                        isRequired={requirement.is_mandatory}
                        file={requirementFiles[requirement.requirement_type] || null}
                        requirementType={requirement.requirement_type}
                        onFileChange={(file) => setRequirementFiles((previous) => ({
                          ...previous,
                          [requirement.requirement_type]: file,
                        }))}
                      />
                    ))
                  )}
                </div>

                {(requirementsError || (errors.email && step === 6)) && (
                  <p className="text-xs text-destructive">{requirementsError || errors.email}</p>
                )}
              </div>
            </>
          )}
                {/* STEP 7 – Program Selection */}
          {step === 7 && (
            <>
              <p className="text-sm text-muted-foreground">Select the program you wish to enroll in:</p>
              {loadingPrograms ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                </div>
              ) : programs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-2 size-8 opacity-40" />
                  <p>No active programs available at the moment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {programs.map(program => (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => set('program_id', program.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-all ${
                        form.program_id === program.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold">{program.name}</p>
                          {program.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{program.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {new Date(program.start_date).toLocaleDateString()} – {new Date(program.end_date).toLocaleDateString()}
                            </span>
                            {program.max_trainees && (
                              <span className="flex items-center gap-1">
                                <Users className="size-3" />
                                Max {program.max_trainees} trainees
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          form.program_id === program.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {form.program_id === program.id && <div className="size-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {errors.program_id && <p className="text-xs text-destructive">{errors.program_id}</p>}

              <Separator />

              {/* Summary preview */}
              <div className="space-y-1 rounded-lg bg-muted/50 p-4 text-sm">
                <p className="mb-2 font-medium text-muted-foreground">Registration Summary</p>
                <p><span className="text-muted-foreground">Name:</span> {form.first_name} {form.middle_name ? form.middle_name[0] + '. ' : ''}{form.last_name}</p>
                <p><span className="text-muted-foreground">Email:</span> {form.email}</p>
                <p><span className="text-muted-foreground">Username:</span> {form.username}</p>
                <p><span className="text-muted-foreground">Program:</span> {programs.find(p => p.id === form.program_id)?.name || '–'}</p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                Your registration will be reviewed by staff before your account is activated.
              </div>
            </>
          )}

          {/* STEP 8 – Email Verification */}
          {step === 8 && (
            <>
              <div className="space-y-1.5">
                {/* Heading and message */}
                {!codeSent && (
                  <>
                    <div className="text-center">
                      <h3 className="text-sm font-semibold">Verify Your Email</h3>
                      <p className="text-xs text-muted-foreground">
                        We'll send a verification code to {form.email}
                      </p>
                    </div>

                    <Button
                      onClick={handleSendVerificationCode}
                      disabled={sendingCode}
                      className="w-full h-8"
                      size="sm"
                    >
                      {sendingCode ? (
                        <>
                          <Loader className="mr-1 size-3 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>Send Code</>
                      )}
                    </Button>
                  </>
                )}

                {codeSent && !isVerified && (
                  <>
                    {/* Message with masked email */}
                    <div className="text-center">
                      <h3 className="text-sm font-semibold">Enter Code</h3>
                      <p className="text-xs text-muted-foreground">
                        Sent to {maskEmail(form.email)}
                      </p>
                    </div>

                    {/* OTPInput component (Task 4.3) */}
                    <OTPInput
                      value={otpValue}
                      onChange={(newVal) => {
                        setOtpValue(newVal.replace(/\D/g, '').slice(0, 6));
                        setOtpError(null);
                      }}
                      onComplete={handleOTPComplete}
                      isLoading={isVerifying}
                      error={otpError}
                      autoFocus={true}
                      placeholder="•"
                    />

                    {/* Verify and Resend buttons in a row */}
                    <div className="flex gap-1.5">
                      <Button
                        onClick={handleVerifyCode}
                        disabled={isVerifying || otpValue.length !== 6}
                        className="flex-1 h-8"
                        size="sm"
                      >
                        {isVerifying ? (
                          <>
                            <Loader className="mr-1 size-3 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>Verify</>
                        )}
                      </Button>

                      {/* Resend Code button with countdown */}
                      <Button
                        variant="outline"
                        onClick={handleResendCode}
                        disabled={sendingCode || !canResend || resendCountdown > 0}
                        className="flex-1 h-8"
                        size="sm"
                      >
                        {sendingCode ? (
                          <>
                            <Loader className="mr-1 size-3 animate-spin" />
                            Sending...
                          </>
                        ) : resendCountdown > 0 ? (
                          <>{resendCountdown}s</>
                        ) : (
                          <>Resend</>
                        )}
                      </Button>
                    </div>
                  </>
                )}

                {isVerified && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-900 dark:bg-green-950/30">
                    <div className="flex items-center gap-1 text-green-900 dark:text-green-300">
                      <CheckCircle2 className="size-3 flex-shrink-0" />
                      <span className="text-xs font-medium">Email verified!</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t px-6 py-4 bg-muted/30">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={back} disabled={submitting}>
                <ChevronLeft className="mr-1 size-4" /> Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Step {step} of {STEPS.length}</span>
            {step < STEPS.length ? (
              <Button onClick={next}>
                Next <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !isVerified}>
                {submitting ? 'Submitting...' : (
                  <>Submit Registration <CheckCircle2 className="ml-2 size-4" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



































