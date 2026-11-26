import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import PWAStatus from '../components/PWAStatus';
import LanguageSegmentedControl from '../components/LanguageSegmentedControl';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
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
  Globe,
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
  const { t, tx } = useLanguage();
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
      toast.info(t('settings.alreadyInstalledToast'));
      return;
    }

    if (canInstall) {
      const result = await promptPWAInstall();
      if (result.outcome === 'accepted') {
        setIsPWAInstalled(true);
        toast.success(t('settings.appInstalledSuccessToast'));
      } else {
        toast.info(t('settings.installCancelledToast'));
      }
    } else {
      setShowManualSteps(true);
      if (iosMode) {
        toast.info(t('settings.iosInstallToast'));
      } else if (desktopMode) {
        toast.info(t('settings.desktopInstallToast'));
      } else {
        toast.info(t('settings.mobileInstallToast'));
      }
    }
  };

  const handleCheckForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.info(t('settings.swUnsupportedToast'));
      return;
    }

    try {
      setIsUpdating(true);
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        toast.success(t('settings.appUpToDateToast'));
      } else {
        toast.info(t('settings.noServiceWorkerToast'));
      }
    } catch {
      toast.error(t('settings.updateCheckFailedToast'));
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
          toast.success(t('settings.pushEnabledToast'));
        } else {
          toast.error(t('settings.pushFailedToast'));
          setNotifications(false);
        }
      } else {
        toast.info(t('settings.pushDeniedToast'));
        setNotifications(false);
      }
    } else {
      const subscriptions = await getUserPushSubscriptions();
      for (const sub of subscriptions) {
        if (sub.isActive) {
          await unsubscribeFromPushNotifications(sub.id);
        }
      }
      toast.info(t('settings.pushDisabledToast'));
    }
  };

  return (
    <DashboardLayout title={isTrainee ? t('settings.traineePageTitle') : t('settings.pageTitle')}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {isTrainee ? t('settings.traineeHeading') : t('settings.heading')}
            </h2>
            <p className="text-muted-foreground mt-1">
              {isTrainee ? t('settings.traineeSubtitle') : t('settings.subtitle')}
            </p>
          </div>
          {isPWAInstalled ? (
            <Badge variant="default" className="bg-green-600 gap-1.5 self-start sm:self-auto py-1 px-2.5">
              <CheckCircle2 className="size-3.5" />
              <span>{t('settings.installedAppBadge')}</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5 self-start sm:self-auto py-1 px-2.5">
              {desktopMode ? <Monitor className="size-3.5" /> : <Smartphone className="size-3.5" />}
              <span>{desktopMode ? t('settings.desktopBrowserBadge') : t('settings.mobileBrowserBadge')}</span>
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
                    <CardTitle className="text-xl">{t('settings.pwaCardTitle')}</CardTitle>
                    <CardDescription>
                      {t('settings.pwaCardDescription', { platform: instructions.label })}
                    </CardDescription>
                  </div>
                </div>
              </div>
              {isPWAInstalled ? (
                <Badge variant="default" className="bg-green-600 text-xs py-0.5 px-2">
                  <CheckCircle2 className="mr-1 size-3" /> {t('settings.installedBadge')}
                </Badge>
              ) : canInstall ? (
                <Badge variant="default" className="bg-blue-600 text-xs animate-pulse py-0.5 px-2">
                  <Sparkles className="mr-1 size-3" /> {t('settings.readyToInstallBadge')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs py-0.5 px-2">
                  <Info className="mr-1 size-3" /> {t('settings.webModeBadge')}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isPWAInstalled ? (
              <div className="space-y-3">
                <Alert className="border-green-500/20 bg-green-500/10 text-green-800 dark:text-green-200">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <AlertTitle className="font-semibold">{t('settings.pwaInstalledAlertTitle')}</AlertTitle>
                  <AlertDescription className="text-sm">
                    {t('settings.pwaInstalledAlertDesc')}
                  </AlertDescription>
                </Alert>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 py-2 px-3.5"
                    onClick={handleCheckForUpdates}
                    disabled={isUpdating}
                  >
                    <RefreshCw className={`size-4 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? t('settings.checkingUpdatesBtn') : t('settings.checkUpdatesBtn')}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {desktopMode ? t('settings.pwaPitchDesktop') : t('settings.pwaPitchMobile')}
                </p>

                {/* Feature highlight grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                    <Wifi className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">{t('settings.offlineSupportTitle')}</p>
                      <p className="text-muted-foreground">{t('settings.offlineSupportDesc')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                    {desktopMode ? (
                      <Monitor className="size-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Smartphone className="size-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-foreground">
                        {desktopMode ? t('settings.desktopShortcutTitle') : t('settings.homeScreenAppTitle')}
                      </p>
                      <p className="text-muted-foreground">
                        {desktopMode ? t('settings.desktopShortcutDesc') : t('settings.homeScreenAppDesc')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                    <Bell className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">{t('settings.fastAlertsTitle')}</p>
                      <p className="text-muted-foreground">{t('settings.fastAlertsDesc')}</p>
                    </div>
                  </div>
                </div>

                {/* Primary Install Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3.5 px-6 shadow-md"
                    onClick={handleInstallPWA}
                  >
                    <Download className="size-5" />
                    <span>{t('settings.downloadInstallBtn')}</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto gap-2 py-3.5 px-6"
                    onClick={() => setShowManualSteps(!showManualSteps)}
                  >
                    <Info className="size-4" />
                    <span>{showManualSteps ? t('settings.hideInstructionsBtn') : t('settings.howToInstallBtn')}</span>
                  </Button>
                </div>

                {/* Step-by-step instructions */}
                {(showManualSteps || iosMode || (!canInstall && !isPWAInstalled)) && (
                  <div className="settings-disclosure-in mt-3 rounded-xl border border-primary/20 bg-muted/60 p-4 text-sm">
                    <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Info className="size-4 text-primary" />
                      {t('settings.installStepsTitle', { platform: instructions.label })}
                    </p>
                    <ol className="list-decimal ml-4 space-y-1.5 text-muted-foreground text-sm">
                      {instructions.steps.map((step, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {tx(step)}
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
          {/* Appearance & Language */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.appearanceTitle')}</CardTitle>
              <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Language Switcher Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Globe className="size-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t('settings.languageLabel')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.languageDesc')}
                    </p>
                  </div>
                </div>
                <LanguageSegmentedControl idPrefix="settings-desktop" />
              </div>

              <Separator />

              {/* Dark Mode Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Moon className="size-5 text-muted-foreground shrink-0" />
                  <div>
                    <Label htmlFor="dark-mode" className="font-medium">{t('settings.darkModeLabel')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.darkModeDesc')}
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
                        <p className="text-sm font-medium text-foreground">{t('settings.brandingLabel')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.brandingDesc')}
                        </p>
                      </div>
                    </div>
                    <Link to="/admin/landing-content">
                      <Button variant="outline" size="sm" className="py-2 px-3.5">
                        {t('settings.manageLogoBtn')}
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.notificationsTitle')}</CardTitle>
              <CardDescription>{t('settings.notificationsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Bell className="size-5 text-muted-foreground shrink-0" />
                  <div>
                    <Label htmlFor="push-notifications" className="font-medium">
                      {t('settings.pushNotificationsLabel')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {isTrainee ? t('settings.pushDescTrainee') : t('settings.pushDescStaff')}
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="email-notifications" className="font-medium">
                    {t('settings.emailNotificationsLabel')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.emailNotificationsDesc')}
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

          {/* PWA Status & Advanced Storage Settings (Golden Rule asymmetric heading mt-8 mb-3) */}
          <div>
            <h3 className="text-lg font-semibold mt-8 mb-3">{t('settings.pwaDiagnosticTitle')}</h3>
            <PWAStatus />
          </div>

          {/* About */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <BrandLogo size="sm" />
                <div>
                  <CardTitle>{t('settings.aboutTitle', { company: companyName })}</CardTitle>
                  <CardDescription>{tagline || t('settings.defaultTagline')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('settings.versionLabel')}</span>
                <span className="font-medium">{t('settings.versionValue')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('settings.appTypeLabel')}</span>
                <span className="font-medium">{t('settings.appTypeValue')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('settings.offlineStorageLabel')}</span>
                <span className="font-medium">IndexedDB + CacheStorage</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* MOBILE LAYOUT (Mobile Screens)                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <Accordion type="single" collapsible defaultValue="appearance" className="md:hidden space-y-4">
          <AccordionItem value="appearance" className="rounded-lg border bg-card px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Globe className="size-5" />
                <span>{t('settings.appearanceTitle')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="space-y-2 pt-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('settings.languageLabel')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.languageDescMobile')}
                  </p>
                </div>
                <LanguageSegmentedControl idPrefix="settings-mobile" className="w-full grid grid-cols-2" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="dark-mode-mobile">{t('settings.darkModeLabel')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.darkModeDescMobile')}
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
                <span>{t('settings.notificationsTitle')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="push-notifications-mobile">{t('settings.pushNotificationsLabel')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.pushDescMobile')}
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
                  <Label htmlFor="email-notifications-mobile">{t('settings.emailNotificationsLabel')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.emailNotificationsDescMobile')}
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
                <span>{t('settings.offlineCacheStatus')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <PWAStatus />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Mobile Save Button */}
        <div className="md:hidden">
          <Button
            className="w-full py-2.5 px-4"
            onClick={() => toast.success(t('settings.settingsSavedToast'))}
          >
            {t('settings.savePreferencesBtn')}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
