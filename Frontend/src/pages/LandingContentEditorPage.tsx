import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DashboardLayout from '../components/DashboardLayout';
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
import { Navigate } from 'react-router-dom';
import api, { getFileUrl } from '../services/api';
import { AlertCircle, Eye, Plus, Trash2, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
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

interface CMSSettingsResponse {
  success: boolean;
  data: {
    id: string;
    tenantId: string;
    settingsData: {
      content: CMSContentFormData;
      appearance?: Record<string, any>;
      layout?: Record<string, any>;
    };
    createdAt: string;
    updatedAt: string;
  };
}

export default function LandingContentEditorPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Role check - only local_admin and super_admin allowed
  if (user && !['local_admin', 'super_admin'].includes(user.role)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900">Access Denied</h3>
                <p className="text-sm text-red-800 mt-1">
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
    defaultValues: {
      hero: {
        badge: '',
        heading: '',
        subheading: '',
        ctaText: 'Enroll Now',
      },
      appearance: {
        logo: '',
        heroBackground: '',
      },
      mission: '',
      vision: '',
      features: [
        { icon: 'Wrench', title: '', description: '' },
        { icon: 'Award', title: '', description: '' },
        { icon: 'Users2', title: '', description: '' },
        { icon: 'Compass', title: '', description: '' },
      ],
      ctaBanner: {
        badge: '',
        heading: '',
        description: '',
        ctaPrimaryText: 'Enroll Now',
        ctaSecondaryText: 'View Programs',
      },
      contact: {
        address: '',
        addressLine2: '',
        phone: '',
        email: '',
        facebook: '',
      },
      footer: {
        companyName: '',
        tagline: '',
      },
    },
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
        const response = await api.get<CMSSettingsResponse>('/cms-settings');
        if (isCancelled) return;
        if (response.success && response.data) {
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
      const response = await api.post<CMSSettingsResponse>('/cms-settings', {
        content: data,
      });

      if (response.success) {
        form.reset(data);
        toast.success('Changes saved successfully', {
          description: 'Your landing page content has been updated.',
        });
      } else {
        toast.error('Failed to save changes', {
          description: response.message || 'Please try again.',
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
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-r-transparent mb-3"></div>
            <p className="text-muted-foreground">Loading landing page content...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Landing Page Content Editor">
      <div className="flex justify-center">
        <div className="space-y-6 max-w-4xl w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FileText className="size-8" />
              Landing Page Content
            </h1>
            <p className="text-muted-foreground mt-2">
              Edit the content that appears on your public landing page
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={previewLandingPage}
              className="gap-2"
            >
              <Eye className="size-4" />
              Preview
            </Button>
          </div>
        </div>

        {/* Unsaved Changes Alert */}
        {hasUnsavedChanges && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              You have unsaved changes. Don't forget to save before leaving the page.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Hero Section */}
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
                <CardDescription>
                  The main banner that appears at the top of your landing page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="hero.badge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Official Training & Workforce Development" {...field} />
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
                        <Input placeholder="e.g., Shape Your Future With Real-World Skills" {...field} />
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
                          className="min-h-24"
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
                        <Input placeholder="e.g., Enroll Now" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Appearance Section - Logo & Hero Background */}
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Logo and banner images for your landing page (use Dropbox URLs)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
            <Card>
              <CardHeader>
                <CardTitle>Mission & Vision</CardTitle>
                <CardDescription>
                  Your organization's core purpose and future direction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="mission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mission Statement</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What is your organization's core purpose?"
                          className="min-h-24"
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
                          className="min-h-24"
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
            <Card>
              <CardHeader>
                <CardTitle>Why Choose Us (Features)</CardTitle>
                <CardDescription>
                  Exactly 4 features that highlight your unique value proposition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {featureFields.map((field, index) => (
                  <div key={field.id} className="space-y-4 p-4 border rounded-lg bg-card">
                    <h4 className="font-semibold text-sm">Feature {index + 1}</h4>

                    <FormField
                      control={form.control}
                      name={`features.${index}.icon`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Icon</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
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
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Practical Workstations" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`features.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., Real equipment and industry-standard tools..."
                              className="min-h-20"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
                {form.formState.errors.features && (
                  <div className="text-sm text-red-600">
                    {form.formState.errors.features.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CTA Banner Section */}
            <Card>
              <CardHeader>
                <CardTitle>Call-to-Action Banner</CardTitle>
                <CardDescription>
                  The promotional banner that encourages users to take action
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="ctaBanner.badge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Start Your Journey" {...field} />
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
                        <Input placeholder="e.g., Ready to Transform Your Career?" {...field} />
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
                          className="min-h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ctaBanner.ctaPrimaryText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Button</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Enroll Now" {...field} />
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
                          <Input placeholder="e.g., View Programs" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Section */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Contact details displayed in the footer and contact section
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="contact.address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Bongabong, Oriental Mindoro" {...field} />
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
                        <Input placeholder="e.g., Philippines" {...field} />
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
                        <Input placeholder="e.g., +63 XXX XXX XXXX" {...field} />
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
                        <Input type="email" placeholder="e.g., info@bmdc.edu.ph" {...field} />
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
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Must be a valid URL starting with https://
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Footer Section */}
            <Card>
              <CardHeader>
                <CardTitle>Footer</CardTitle>
                <CardDescription>
                  Information displayed at the bottom of your landing page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="footer.companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Bongabong Manpower Development Center"
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
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={!hasUnsavedChanges || isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !form.formState.isValid}>
                {isSaving ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-r-transparent mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </div>
    </DashboardLayout>
  );
}

