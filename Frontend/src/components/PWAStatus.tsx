import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  Download,
  Bell,
  BellOff,
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  HardDrive,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  requestNotificationPermission,
  canInstallPWA,
  promptPWAInstall,
  subscribeInstallPrompt,
  isDesktop,
  isIOS,
  isStandalone,
  getInstallInstructions,
} from '../utils/pwa';

export default function PWAStatus() {
  const [isInstalled, setIsInstalled] = useState(isStandalone());
  const [canInstall, setCanInstall] = useState(canInstallPWA());
  const [showInstructions, setShowInstructions] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<'active' | 'installing' | 'waiting' | 'none'>('none');

  const instructions = getInstallInstructions();
  const desktopPlatform = isDesktop();

  useEffect(() => {
    // Check if installed
    setIsInstalled(isStandalone());

    const unsubscribe = subscribeInstallPrompt((available) => {
      setCanInstall(available);
      if (isStandalone()) {
        setIsInstalled(true);
      }
    });

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          setServiceWorkerStatus('active');
        } else if (registration.installing) {
          setServiceWorkerStatus('installing');
        } else if (registration.waiting) {
          setServiceWorkerStatus('waiting');
        }
      });
    }

    // Get storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      });
    }

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleNotificationToggle = async () => {
    if (notificationPermission === 'granted') {
      toast.info('Notification permissions are managed in your browser settings');
      return;
    }

    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast.success('Notifications enabled!');
    } else if (permission === 'denied') {
      toast.error('Notifications blocked. Please enable in browser settings.');
    }
  };

  const handleClearCache = async () => {
    if (!('caches' in window)) {
      toast.error('Cache API not supported');
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      toast.success('Cache cleared successfully');
      
      // Update storage estimate
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      }
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  const handleUpdateServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.error('Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        toast.success('Checking for updates...');
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStoragePercentage = (): number => {
    if (!storageEstimate || storageEstimate.quota === 0) return 0;
    return Math.round((storageEstimate.usage / storageEstimate.quota) * 100);
  };

  return (
    <div className="space-y-4">
      {/* Installation Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {desktopPlatform ? <Monitor className="size-5 text-primary" /> : <Smartphone className="size-5 text-primary" />}
                Installation Status
              </CardTitle>
              <CardDescription>
                Progressive Web App (PWA) for {instructions.label}
              </CardDescription>
            </div>
            {isInstalled ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="mr-1 size-3" />
                Installed
              </Badge>
            ) : canInstall ? (
              <Badge variant="default" className="bg-blue-600">
                <Download className="mr-1 size-3" />
                Ready to Install
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Info className="mr-1 size-3" />
                Browser Mode
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isInstalled && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium text-foreground">
                Install BMDC on your {desktopPlatform ? 'Desktop computer' : 'Mobile device'} for:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Instant loading and offline access
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Home screen or desktop app shortcut
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Full-screen experience without browser tabs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Background updates & notification alerts
                </li>
              </ul>

              <div className="mt-4 flex flex-col gap-2">
                {canInstall ? (
                  <Button
                    className="w-full gap-2"
                    onClick={async () => {
                      const res = await promptPWAInstall();
                      if (res.outcome === 'accepted') {
                        setIsInstalled(true);
                        toast.success('App installation started!');
                      }
                    }}
                  >
                    <Download className="size-4" />
                    Download & Install App
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setShowInstructions(!showInstructions)}
                  >
                    <Info className="size-4" />
                    {showInstructions ? 'Hide Instructions' : 'How to Download & Install'}
                  </Button>
                )}

                {(!canInstall || showInstructions) && (
                  <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
                    <p className="font-semibold text-foreground mb-1">
                      Installation Steps ({instructions.label}):
                    </p>
                    <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                      {instructions.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {isInstalled && (
            <div className="rounded-lg bg-green-500/10 p-4 border border-green-500/20">
              <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                You are currently running BMDC in installed standalone app mode!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="size-5 text-green-600" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="size-5 text-red-600" />
                Offline
              </>
            )}
          </CardTitle>
          <CardDescription>Network connection status</CardDescription>
        </CardHeader>
        <CardContent>
          {isOnline ? (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <CheckCircle2 className="size-4" />
              Connected to the internet
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <XCircle className="size-4" />
                No internet connection
              </div>
              <p className="text-xs text-muted-foreground">
                You can still view cached data while offline
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {notificationPermission === 'granted' ? (
              <Bell className="size-5" />
            ) : (
              <BellOff className="size-5" />
            )}
            Notifications
          </CardTitle>
          <CardDescription>Receive updates and alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Enable Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Get notified about important updates
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notificationPermission === 'granted'}
              onCheckedChange={handleNotificationToggle}
            />
          </div>

          {notificationPermission === 'denied' && (
            <div className="rounded-lg bg-red-500/10 p-3 border border-red-500/20">
              <p className="text-xs text-red-700 dark:text-red-300">
                Notifications are blocked. Please enable them in your browser settings.
              </p>
            </div>
          )}

          {notificationPermission === 'granted' && (
            <div className="rounded-lg bg-green-500/10 p-3 border border-green-500/20">
              <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="size-3" />
                Notifications enabled
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5" />
            Storage
          </CardTitle>
          <CardDescription>App data and cache usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storageEstimate && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">
                  {formatBytes(storageEstimate.usage)} of {formatBytes(storageEstimate.quota)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${getStoragePercentage()}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {getStoragePercentage()}% of available storage used
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleClearCache}
          >
            <Trash2 className="mr-2 size-4" />
            Clear Cache
          </Button>
        </CardContent>
      </Card>

      {/* Service Worker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="size-5" />
                Service Worker
              </CardTitle>
              <CardDescription>Background sync and offline support</CardDescription>
            </div>
            <Badge
              variant={serviceWorkerStatus === 'active' ? 'default' : 'secondary'}
              className={serviceWorkerStatus === 'active' ? 'bg-green-500' : ''}
            >
              {serviceWorkerStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {serviceWorkerStatus === 'active' && (
            <div className="rounded-lg bg-green-500/10 p-3 border border-green-500/20">
              <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="size-3" />
                Service worker is running properly
              </p>
            </div>
          )}

          {serviceWorkerStatus === 'none' && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                Service worker not registered. Some offline features may not be available.
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleUpdateServiceWorker}
          >
            <RefreshCw className="mr-2 size-4" />
            Check for Updates
          </Button>
        </CardContent>
      </Card>

      {/* PWA Features */}
      <Card>
        <CardHeader>
          <CardTitle>PWA Features</CardTitle>
          <CardDescription>Available progressive web app capabilities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Offline Mode</span>
              {'serviceWorker' in navigator ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Push Notifications</span>
              {'Notification' in window ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Background Sync</span>
              {'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Camera Access</span>
              {'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
