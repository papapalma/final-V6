import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DashboardLayout from '../components/DashboardLayout';
import { useBranding } from '../contexts/BrandingContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../components/ui/form';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api, { getFileUrl } from '../services/api';
import { AlertCircle, Eye, FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import ImageUpload from '../components/ImageUpload';

// Zod validation schema
const featureSchema = z.object({
  icon: z.enum(['Wrench', 'Award', 'Users2', 'Compass'], {
    message: 'Please select a valid icon',
  }),
  title: z.string().max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters'),
});

const cmsContentSchema = z.object({
  hero: z.object({
    badge: z.string().max(100, 'Badge must be less than 100 characters'),
    heading: z.string().min(1, 'Hero heading is required').max(200, 'Heading must be less than 200 characters'),
    subheading: z.string().max(500, 'Subheading must be less than 500 characters'),
    ctaText: z.string().max(50, 'CTA text must be less than 50 characters'),
  }),
  appearance: z.object({
    logo: z.string().optional(),
    heroBackground: z.string().optional(),
  }).optional(),
  mission: z.string().max(1000, 'Mission must be less than 1000 characters'),
  vision: z.string().max(1000, 'Vision must be less than 1000 characters'),
  features: z.array(featureSchema).length(4, 'Exactly 4 features are required'),
  ctaBanner: z.object({
    badge: z.string().max(100, 'Badge must be less than 100 characters'),
    heading: z.string().max(200, 'Heading must be less than 200 characters'),
    description: z.string().max(500, 'Description must be less than 500 characters'),
    ctaPrimaryText: z.string().max(50, 'Text must be less than 50 characters'),
    ctaSecondaryText: z.string().max(50, 'Text must be less than 50 characters'),
  }),
  contact: z.object({
    address: z.string().max(200, 'Address must be less than 200 characters'),
    addressLine2: z.string().max(200, 'Address line 2 must be less than 200 characters').optional().or(z.literal('')),
    phone: z.string().max(50, 'Phone must be less than 50 characters'),
    email: z.string().email('Invalid email address').or(z.literal('')),
    facebook: z.string().url('Facebook URL must be valid').optional().or(z.literal('')),
  }),
  footer: z.object({
    companyName: z.string().max(100, 'Company name must be less than 100 characters'),
    tagline: z.string().max(200, 'Tagline must be less than 200 characters'),
  }),
});

type CMSContentFormData = z.infer<typeof cmsContentSchema>;

interface CMSSettingsData {
  content?: CMSContentFormData;
  settingsId?: string;
  settingsData?: {
    content?: CMSContentFormData;
  };
  [key: string]: any;
}

const DEFAULT_CONTENT: CMSContentFormData = {
  hero: {
    badge: 'Official Training & Workforce Development',
    heading: 'Shape Your Future with Practical Skills',
    subheading: 'Join Bongabong Manpower Development Center and acquire industry-standard technical skills.',
    ctaText: 'Enroll Now',
  },
  appearance: {
    logo: '',
    heroBackground: '',
  },
  mission: 'To provide accessible, high-quality technical-vocational training and education to empower individuals and strengthen community growth.',
  vision: 'A premier center of excellence producing globally competent, innovative, and value-driven professionals.',
  features: [
    { icon: 'Wrench', title: 'Practical Hands-on Training', description: 'Real-world workshops and state-of-the-art tools' },
    { icon: 'Award', title: 'TESDA Certified Programs', description: 'Industry-recognized national certifications' },
    { icon: 'Users2', title: 'Expert Instructors', description: 'Experienced trainers dedicated to your growth' },
    { icon: 'Compass', title: 'Career Guidance & Support', description: 'Comprehensive pathways to employment' },
  ],
  ctaBanner: {
    badge: 'Get Started Today',
    heading: 'Ready to Transform Your Career?',
    description: 'Enroll in our certified training programs and start building practical skills today.',
    ctaPrimaryText: 'Enroll Now',
    ctaSecondaryText: 'View Programs',
  },
  contact: {
    address: 'Bongabong, Oriental Mindoro',
    addressLine2: 'Philippines',
    phone: '+63 912 345 6789',
    email: 'info@bmdc.edu.ph',
    facebook: '',
  },
  footer: {
    companyName: 'Bongabong Manpower Development Center',
    tagline: 'Empowering Communities Through Practical Skills',
  },
};

export default function LandingContentEditorPage() {
  const { user } = useAuth();
  const { applyBrandingContent } = useBranding();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Role check - only local_admin and super_admin allowed
  if (user && !['local_admin', 'super_admin'].includes(user.role)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30 rounded-2xl shadow-sm">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-300">Access Denied</h3>
                <p className="text-sm text-red-800 dark:text-red-400 mt-1">
                  You don't have permission to access the landing page content editor. Only administrators can make these changes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const form = useForm<CMSContentFormData>({
    resolver: zodResolver(cmsContentSchema),
    mode: 'onBlur',
    defaultValues: DEFAULT_CONTENT,
  });

  const { fields: featureFields } = useFieldArray({
    control: form.control,
    name: 'features',
  });

  // Load current CMS settings on mount
  useEffect(() => {
    let isCancelled = false;

    const loadCmsSettings = async () => {
      setIsLoading(true);
      try {
        let response: any = null;
        try {
          response = await api.get<CMSSettingsData>('/cms-settings');
        } catch (firstErr) {
          // Automatic resilient fallback to /landing-content
          response = await api.get<CMSSettingsData>('/landing-content');
        }

        if (isCancelled) return;
        if (response && response.success && response.data) {
          const content = (response.data as any)?.settingsData?.content || (response.data as any)?.content;
          if (content) {
            // Convert file paths to URLs for preview in ImageUpload
            const contentWithUrls = {
              ...content,
              appearance: {
                ...content.appearance,
                logo: content.appearance?.logo ? getFileUrl(content.appearance.logo) : '',
                heroBackground: content.appearance?.heroBackground ? getFileUrl(content.appearance.heroBackground) : '',
              },
            };
            form.reset(contentWithUrls);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load CMS settings:', error);
          toast.error('Failed to load CMS settings', {
            description: 'Please refresh the page and try again.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCmsSettings();

    return () => {
      isCancelled = true;
    };
  }, [form]);

  const onSubmit = async (data: CMSContentFormData) => {
    setIsSaving(true);
    try {
      let response: any;
      try {
        response = await api.post<CMSSettingsData>('/cms-settings', {
          content: data,
        });
      } catch (firstPostErr) {
        response = await api.post<CMSSettingsData>('/landing-content', {
          content: data,
        });
      }

      if (response && response.success) {
        const savedContent = response.data?.content || data;
        applyBrandingContent(savedContent);
        const resetData = {
          ...savedContent,
          appearance: {
            ...savedContent.appearance,
            logo: savedContent.appearance?.logo ? getFileUrl(savedContent.appearance.logo) : '',
            heroBackground: savedContent.appearance?.heroBackground ? getFileUrl(savedContent.appearance.heroBackground) : '',
          },
        };
        form.reset(resetData);
        toast.success('Changes saved successfully', {
          description: 'Your organization branding and landing page content have been updated across the app.',
        });
      } else {
        toast.error('Failed to save changes', {
          description: response?.message || 'Please try again.',
        });
      }
    } catch (error: any) {
      console.error('Error saving CMS settings:', error);
      toast.error('Error saving changes', {
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const previewLandingPage = () => {
    window.open('/', '_blank');
  };

  const hasUnsavedChanges = form.formState.isDirty;

  if (isLoading) {
    return (
      <DashboardLayout title="Landing Page Content Editor">
        <div className="flex justify-center">
          <div className="space-y-6 max-w-4xl w-full pb-16">
            {/* Header Skeleton */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-64 rounded-lg" />
                  <p className="text-muted-foreground text-sm font-medium">Loading landing page content...</p>
                </div>
              </div>
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>

            {/* Section Card Skeletons */}
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-2xl border border-border/60 bg-card shadow-xs">
                <CardHeader className="p-6 pb-4 border-b border-border/40 space-y-2">
                  <Skeleton className="h-5 w-48 rounded-md" />
                  <Skeleton className="h-3.5 w-72 rounded-md" />
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20 rounded-md" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Landing Page Content Editor">
      <div className="flex justify-center">
        <div className="space-y-6 max-w-4xl w-full pb-20">
          {/* Header (Apple HIG Design) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/10 shadow-xs shrink-0">
                <FileText className="size-6" />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Landing Page Content
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Customize and publish the real-time public content for your training center
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={previewLandingPage}
                className="gap-2 rounded-xl border-input bg-card shadow-xs hover:bg-muted active:scale-[0.98] transition-all"
              >
                <Eye className="size-4" />
                Preview
              </Button>
            </div>
          </div>

          {/* Unsaved Changes Alert (Apple Capsule) */}
          {hasUnsavedChanges && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 p-4 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-xs backdrop-blur-sm animate-in fade-in-0 duration-200">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs sm:text-sm font-medium">
                  You have unsaved changes. Don't forget to save before leaving the page.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => form.reset()}
                className="text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 rounded-xl shrink-0 active:scale-95 transition-all"
              >
                Reset
              </Button>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Hero Section */}
              <Card className="rounded-2xl border border-border/60 bg-card shadow-xs backdrop-blur-sm overflow-hidden transition-all hover:border-border/80">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    Hero Section
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    The main banner that appears at the top of your landing page
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="hero.badge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Badge</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Official Training & Workforce Development"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hero.heading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heading</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Shape Your Future With Real-World Skills"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hero.subheading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subheading</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Acquire industry-standard technical training..."
                            className="min-h-24 rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hero.ctaText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary CTA Button Text</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Enroll Now"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Appearance Section - Logo & Hero Background */}
              <Card className="rounded-2xl border border-border/60 bg-card shadow-xs backdrop-blur-sm overflow-hidden transition-all hover:border-border/80">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    Appearance
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Organization logo (applied across sidebar, login, browser tab, print slips, reports, PDFs, and landing page) and hero banner
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <FormField
                    control={form.control}
                    name="appearance.logo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value || ''}
                            onChange={field.onChange}
                            label=""
                            description="Upload your organization logo (PNG, JPG, etc. up to 5MB)"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="appearance.heroBackground"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hero Background Image</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value || ''}
                            onChange={field.onChange}
                            label=""
                            description="Upload a background image for your hero section (optional, PNG, JPG, etc. up to 5MB)"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Mission & Vision Section */}
              <Card className="rounded-2xl border border-border/60 bg-card shadow-xs backdrop-blur-sm overflow-hidden transition-all hover:border-border/80">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    Mission & Vision
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Your organization's core purpose and future direction
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="mission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mission Statement</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What is your organization's core purpose?"
                            className="min-h-24 rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vision"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vision Statement</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What is your future direction and aspiration?"
                            className="min-h-24 rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Features Section */}
              <Card className="rounded-2xl border border-border/60 bg-card shadow-xs backdrop-blur-sm overflow-hidden transition-all hover:border-border/80">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    Why Choose Us (Features)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Exactly 4 features that highlight your unique value proposition
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {featureFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3.5 hover:bg-muted/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
                            Feature {index + 1}
                          </h4>
                          <span className="size-2 rounded-full bg-primary/40"></span>
                        </div>

                        <FormField
                          control={form.control}
                          name={`features.${index}.icon`}
                          render={({ field: iconField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Icon</FormLabel>
                              <Select value={iconField.value} onValueChange={iconField.onChange}>
                                <FormControl>
                                  <SelectTrigger className="rounded-xl border-input bg-background/80 text-sm">
                                    <SelectValue placeholder="Select an icon" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Wrench">Wrench (Tools)</SelectItem>
                                  <SelectItem value="Award">Award (Achievement)</SelectItem>
                                  <SelectItem value="Users2">Users2 (Team)</SelectItem>
                                  <SelectItem value="Compass">Compass (Direction)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`features.${index}.title`}
                          render={({ field: titleField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Title</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Practical Workstations"
                                  className="rounded-xl border-input bg-background/80 text-sm"
                                  {...titleField}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`features.${index}.description`}
                          render={({ field: descField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="e.g., Real equipment and industry-standard tools..."
                                  className="min-h-20 rounded-xl border-input bg-background/80 text-sm"
                                  {...descField}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  {form.formState.errors.features && (
                    <div className="text-xs font-medium text-destructive mt-2">
                      {form.formState.errors.features.message}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CTA Banner Section */}
              <Card className="rounded-2xl border border-border/60 bg-card shadow-xs backdrop-blur-sm overflow-hidden transition-all hover:border-border/80">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    Call-to-Action Banner
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    The promotional banner that encourages users to take action
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="ctaBanner.badge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Badge</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Start Your Journey"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ctaBanner.heading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heading</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Ready to Transform Your Career?"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ctaBanner.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Join thousands of successful graduates..."
                            className="min-h-20 rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ctaBanner.ctaPrimaryText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Button</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Enroll Now"
                              className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ctaBanner.ctaSecondaryText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Button</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., View Programs"
                              className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contact Section */}
              <Card className="rounded-2xl border border-border/60 bg-card shadow-xs backdrop-blur-sm overflow-hidden transition-all hover:border-border/80">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    Contact Information
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Contact details displayed in the footer and contact section
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="contact.address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Bongabong, Oriental Mindoro"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact.addressLine2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2 (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Philippines"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., +63 XXX XXX XXXX"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="e.g., info@bmdc.edu.ph"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact.facebook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook Profile URL (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="e.g., https://www.facebook.com/profile.php?id=..."
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Must be a valid URL starting with https://
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Footer Section */}
              <Card className="rounded-2xl border border-border/60 bg-card shadow-xs backdrop-blur-sm overflow-hidden transition-all hover:border-border/80">
                <CardHeader className="p-6 pb-4 border-b border-border/40">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    Footer
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Information displayed at the bottom of your landing page
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="footer.companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Bongabong Manpower Development Center"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="footer.tagline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tagline</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Empowering Communities Through Practical Skills"
                            className="rounded-xl border-input bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Sticky Glassmorphic Apple Action Bar */}
              <div className="sticky bottom-4 z-20 rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-4 shadow-lg flex items-center justify-between gap-4 transition-all">
                <div className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                  {hasUnsavedChanges ? (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Unsaved changes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="size-3.5" />
                      All changes up to date
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={!hasUnsavedChanges || isSaving}
                    className="rounded-xl border-input px-4 text-xs font-medium active:scale-[0.98] transition-all"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving || !form.formState.isValid}
                    className="rounded-xl px-4 text-xs font-medium shadow-xs active:scale-[0.98] transition-all"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </DashboardLayout>
  );
}
