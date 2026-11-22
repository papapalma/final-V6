import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import PWAStatus from '../components/PWAStatus';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import {
  Bell,
  Moon,
  Download,
  Smartphone,
  Monitor,
  CheckCircle2,
  RefreshCw,
  Info,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getUserPushSubscriptions,
} from '../utils/pushSubscription';
import {
  isStandalone,
  isDesktop,
  isIOS,
  canInstallPWA,
  promptPWAInstall,
  subscribeInstallPrompt,
  getInstallInstructions,
} from '../utils/pwa';

export default function SettingsPage() {
  const { user, hasPermission } = useAuth();
  const { companyName, tagline } = useBranding();
  const { isDark, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(isStandalone());
  const [canInstall, setCanInstall] = useState(canInstallPWA());
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const desktopMode = isDesktop();
  const iosMode = isIOS();
  const instructions = getInstallInstructions();
  const isTrainee = user?.role === 'trainee';

  useEffect(() => {
    setIsPWAInstalled(isStandalone());

    const unsubscribePrompt = subscribeInstallPrompt((available) => {
      setCanInstall(available);
      if (isStandalone()) {
        setIsPWAInstalled(true);
      }
    });

    // Check for active push subscriptions
    getUserPushSubscriptions().then((subscriptions) => {
      const hasActive = subscriptions.some((sub) => sub.isActive);
      setNotifications(hasActive);
    });

    return () => {
      unsubscribePrompt();
    };
  }, []);

  const handleInstallPWA = async () => {
    if (isPWAInstalled) {
      toast.info('BMDC App is already installed on this device!');
      return;
    }

    if (canInstall) {
      const result = await promptPWAInstall();
      if (result.outcome === 'accepted') {
        setIsPWAInstalled(true);
        toast.success('BMDC App installed successfully!');
      } else {
        toast.info('Installation cancelled.');
      }
    } else {
      setShowManualSteps(true);
      if (iosMode) {
        toast.info('Tap the Safari Share button and select "Add to Home Screen"');
      } else if (desktopMode) {
        toast.info('Look for the Install icon in your browser address bar or menu');
      } else {
        toast.info('Open your browser menu (⋮) and select "Install app"');
      }
    }
  };

  const handleCheckForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.info('Service Worker not supported in this browser.');
      return;
    }

    try {
      setIsUpdating(true);
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        toast.success('BMDC App is up to date!');
      } else {
        toast.info('No active service worker found.');
      }
    } catch (error) {
      toast.error('Failed to check for updates.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotificationToggle = async (checked: boolean) => {
    setNotifications(checked);
    if (checked && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const subscriptionId = await subscribeToPushNotifications();
        if (subscriptionId) {
          toast.success('Push notifications enabled');
        } else {
          toast.error('Failed to enable push notifications');
          setNotifications(false);
        }
      } else {
        toast.info('Notification permission denied');
        setNotifications(false);
      }
    } else {
      const subscriptions = await getUserPushSubscriptions();
      for (const sub of subscriptions) {
        if (sub.isActive) {
          await unsubscribeFromPushNotifications(sub.id);
        }
      }
      toast.info('Notifications disabled');
    }
  };

  return (
    <DashboardLayout title={isTrainee ? 'Trainee Settings' : 'Settings'}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {isTrainee ? 'Trainee Settings & Preferences' : 'Settings'}
            </h2>
            <p className="text-muted-foreground">
              {isTrainee
                ? 'Manage your portal preferences and download the BMDC app for your phone or computer'
                : 'Manage your app preferences and configuration'}
            </p>
          </div>
          {isPWAInstalled ? (
            <Badge variant="default" className="bg-green-600 gap-1.5 self-start sm:self-auto py-1 px-3">
              <CheckCircle2 className="size-3.5" />
              <span>Installed App</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5 self-start sm:self-auto py-1 px-3">
              {desktopMode ? <Monitor className="size-3.5" /> : <Smartphone className="size-3.5" />}
              <span>{desktopMode ? 'Desktop Browser' : 'Mobile Browser'}</span>
            </Badge>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* DEDICATED PWA DOWNLOAD & INSTALL CARD (Both Desktop and Mobile)      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <Card className="border-2 border-primary/20 shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Download className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Download BMDC App</CardTitle>
                    <CardDescription>
                      Progressive Web App (PWA) for {instructions.label}
                    </CardDescription>
                  </div>
                </div>
              </div>
              {isPWAInstalled ? (
                <Badge variant="default" className="bg-green-600 text-xs">
                  <CheckCircle2 className="mr-1 size-3" /> Installed
                </Badge>
              ) : canInstall ? (
                <Badge variant="default" className="bg-blue-600 text-xs animate-pulse">
                  <Sparkles className="mr-1 size-3" /> Ready to Install
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <Info className="mr-1 size-3" /> Web Mode
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isPWAInstalled ? (
              <div className="space-y-3">
                <Alert className="border-green-500/20 bg-green-500/10 text-green-800 dark:text-green-200">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <AlertTitle className="font-semibold">BMDC App is installed!</AlertTitle>
                  <AlertDescription className="text-sm">
                    You are enjoying the full standalone BMDC application experience with offline capabilities,
                    instant launching, and fast cache performance.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleCheckForUpdates}
                    disabled={isUpdating}
                  >
                    <RefreshCw className={`size-4 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? 'Checking...' : 'Check for App Updates'}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Install BMDC on your {desktopMode ? 'desktop computer' : 'mobile phone'} for a faster,
                  native app experience without browser URL bars or tabs. Access your attendance QR code,
                  training modules, and records even without an active internet connection.
                </p>

                {/* Feature highlight grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                    <Wifi className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Offline Support</p>
                      <p className="text-muted-foreground">Access schedules and profiles without internet</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                    {desktopMode ? (
                      <Monitor className="size-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Smartphone className="size-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-foreground">
                        {desktopMode ? 'Desktop Shortcut' : 'Home Screen App'}
                      </p>
                      <p className="text-muted-foreground">
                        {desktopMode ? 'Launches in its own clean window' : 'One-tap access like a native app'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                    <Bell className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Fast Alerts</p>
                      <p className="text-muted-foreground">Real-time attendance reminders and notices</p>
                    </div>
                  </div>
                </div>

                {/* Primary Install Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-md"
                    onClick={handleInstallPWA}
                  >
                    <Download className="size-5" />
                    <span>Download & Install BMDC App</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto gap-2"
                    onClick={() => setShowManualSteps(!showManualSteps)}
                  >
                    <Info className="size-4" />
                    <span>{showManualSteps ? 'Hide Instructions' : 'How to Install'}</span>
                  </Button>
                </div>

                {/* Step-by-step instructions (expanded by default if not direct promptable or on toggle) */}
                {(showManualSteps || iosMode || (!canInstall && !isPWAInstalled)) && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-muted/60 p-4 text-sm">
                    <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Info className="size-4 text-primary" />
                      Installation Steps for {instructions.label}:
                    </p>
                    <ol className="list-decimal ml-5 space-y-1.5 text-muted-foreground text-sm">
                      {instructions.steps.map((step, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* DESKTOP LAYOUT (Tablet / Desktop Screens)                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="hidden md:block space-y-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="size-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="dark-mode" className="font-medium">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Switch between light and dark theme
                    </p>
                  </div>
                </div>
                <Switch
                  id="dark-mode"
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                />
              </div>
              {hasPermission('canManageCMS') && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <BrandLogo size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Organization Logo &amp; Branding</p>
                        <p className="text-sm text-muted-foreground">
                          Update the logo used across sidebar, login, browser tab, printouts, and landing page
                        </p>
                      </div>
                    </div>
                    <Link to="/admin/landing-content">
                      <Button variant="outline" size="sm">Manage Logo</Button>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="size-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="push-notifications" className="font-medium">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      {isTrainee
                        ? 'Receive attendance reminders, program updates, and announcements'
                        : 'Receive notifications for overdue items and center alerts'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="push-notifications"
                  checked={notifications}
                  onCheckedChange={handleNotificationToggle}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications" className="font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive daily summary and official announcements via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </CardContent>
          </Card>

          {/* PWA Status & Advanced Storage Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-3">PWA Diagnostic & Offline Storage</h3>
            <PWAStatus />
          </div>

          {/* About */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <BrandLogo size="sm" />
                <div>
                  <CardTitle>About {companyName}</CardTitle>
                  <CardDescription>{tagline || 'Application & system information'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version:</span>
                <span className="font-medium">1.2.0 (PWA Enabled)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Application Type:</span>
                <span className="font-medium">Responsive Progressive Web App (Desktop & Mobile)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Offline Storage:</span>
                <span className="font-medium">IndexedDB + CacheStorage</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* MOBILE LAYOUT (Mobile Screens)                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <Accordion type="single" collapsible className="md:hidden space-y-4">
          <AccordionItem value="appearance" className="rounded-lg border bg-card px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Moon className="size-5" />
                <span>Appearance</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="dark-mode-mobile">Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Switch theme
                  </p>
                </div>
                <Switch
                  id="dark-mode-mobile"
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notifications" className="rounded-lg border bg-card px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Bell className="size-5" />
                <span>Notifications</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="push-notifications-mobile">Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Program & attendance alerts
                  </p>
                </div>
                <Switch
                  id="push-notifications-mobile"
                  checked={notifications}
                  onCheckedChange={handleNotificationToggle}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications-mobile">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Daily summary
                  </p>
                </div>
                <Switch
                  id="email-notifications-mobile"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pwa-advanced" className="rounded-lg border bg-card px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Wifi className="size-5" />
                <span>Offline & Cache Status</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <PWAStatus />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Mobile Save Button */}
        <div className="md:hidden">
          <Button className="w-full" onClick={() => toast.success('Settings saved!')}>
            Save Preferences
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
