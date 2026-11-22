// PWA Service Worker Registration
import logger from './logger';
import { initializePushNotifications } from './pushSubscription';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

// Globally listen for the install prompt as early as possible
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    logger.info('PWA install prompt deferred and ready');
    installListeners.forEach((callback) => callback(true));
  });

  window.addEventListener('appinstalled', () => {
    logger.info('PWA installed successfully');
    deferredPrompt = null;
    installListeners.forEach((callback) => callback(false));
  });
}

// Check if install prompt is currently available
export function canInstallPWA(): boolean {
  return deferredPrompt !== null;
}

// Retrieve deferred install prompt
export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

// Subscribe to install availability changes
export function subscribeInstallPrompt(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(deferredPrompt !== null);
  return () => {
    installListeners.delete(callback);
  };
}

// Trigger PWA installation prompt
export async function promptPWAInstall(): Promise<{ outcome: 'accepted' | 'dismissed' | 'unsupported' }> {
  if (!deferredPrompt) {
    return { outcome: 'unsupported' };
  }
  try {
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      deferredPrompt = null;
      installListeners.forEach((callback) => callback(false));
    }
    return result;
  } catch (error) {
    logger.error('Error triggering PWA install prompt', { error });
    return { outcome: 'unsupported' };
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Never intercept Vite dev modules/HMR with a Service Worker; clean up any stale dev SW
  if (import.meta.env.DEV) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
      .then(() => clearAllCaches())
      .catch(() => {});
    return;
  }

  const doRegister = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        logger.debug('Service worker registered', { scope: registration.scope });
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
        
        // Listen for new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                if (confirm('New version available! Reload to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch(registrationError => {
        logger.error('Service worker registration failed', { error: registrationError });
      });
  };

  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister, { once: true });
  }
}

// Check if app is running in standalone mode (installed as PWA)
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

// Check if running on iOS
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Check if running on Android
export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

// Check if running on Desktop
export function isDesktop(): boolean {
  return !isIOS() && !isAndroid() && !/Mobile|Mobi|Tablet|iPad/i.test(navigator.userAgent);
}

// Get device-specific install instructions
export function getInstallInstructions(): {
  platform: 'desktop' | 'ios' | 'android' | 'browser';
  label: string;
  steps: string[];
} {
  if (isIOS()) {
    return {
      platform: 'ios',
      label: 'Apple iOS (iPhone / iPad)',
      steps: [
        'Open this site in Safari.',
        'Tap the Share button (the square with an arrow pointing up ⎋).',
        'Scroll down and tap "Add to Home Screen".',
        'Tap "Add" in the top-right corner to finish.'
      ]
    };
  }

  if (isAndroid()) {
    return {
      platform: 'android',
      label: 'Android Device',
      steps: [
        'Tap the "Download & Install App" button or tap browser menu (⋮).',
        'Select "Install app" or "Add to Home screen".',
        'Confirm the installation prompt.'
      ]
    };
  }

  if (isDesktop()) {
    return {
      platform: 'desktop',
      label: 'Desktop (Windows / macOS / ChromeOS)',
      steps: [
        'Click the "Download & Install App" button below, or look for the Install icon (computer with down arrow or ⊕) in your browser address bar.',
        'Alternatively, open Chrome/Edge menu (⋮ or …) > "Apps" > "Install Bongabong MDC...".',
        'Click "Install" to create a desktop app shortcut and launch in a dedicated window.'
      ]
    };
  }

  return {
    platform: 'browser',
    label: 'Web Browser',
    steps: [
      'Open your browser settings or menu.',
      'Select "Install BMDC" or "Add to Home Screen".',
      'Follow the on-screen instructions.'
    ]
  };
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    logger.warn('Browser does not support notifications');
    return 'denied';
  }
  
  return await Notification.requestPermission();
}

// Show notification
export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Use service worker for notification
      navigator.serviceWorker.ready.then((registration) => {
        const notificationOptions = {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          vibrate: [200, 100, 200],
          ...options,
        } as NotificationOptions & { vibrate?: number[] };

        registration.showNotification(title, notificationOptions);
      });
    } else {
      // Fallback to regular notification
      const notificationOptions = {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options,
      } as NotificationOptions;

      new Notification(title, notificationOptions);
    }
  }
}

// Handle online/offline events
export function setupOnlineOfflineHandlers(callbacks?: {
  onOnline?: () => void;
  onOffline?: () => void;
}) {
  window.addEventListener('online', () => {
    logger.info('App is online');
    callbacks?.onOnline?.();
    
    // Attempt to sync data
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        return (registration as any).sync.register('sync-data');
      });
    }
  });

  window.addEventListener('offline', () => {
    logger.info('App is offline');
    callbacks?.onOffline?.();
  });
}

// Get network status
export function getNetworkStatus(): {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
} {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
  };
}

// Cache URLs for offline access
export async function cacheUrls(urls: string[]): Promise<void> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      urls,
    });
  }
}

// Clear all caches
export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
}

// Get cache size
export async function getCacheSize(): Promise<number> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  return 0;
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return await navigator.storage.persist();
  }
  return false;
}

// Check if storage is persisted
export async function isStoragePersisted(): Promise<boolean> {
  if ('storage' in navigator && 'persisted' in navigator.storage) {
    return await navigator.storage.persisted();
  }
  return false;
}

// Register background sync
export async function registerBackgroundSync(tag: string): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register(tag);
  }
}

// Request periodic background sync (experimental)
export async function requestPeriodicSync(tag: string, minInterval: number): Promise<void> {
  if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).periodicSync.register(tag, {
      minInterval,
    });
  }
}

// Get periodic sync tags
export async function getPeriodicSyncTags(): Promise<string[]> {
  if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    return await (registration as any).periodicSync.getTags();
  }
  return [];
}

// Share content using Web Share API
export async function shareContent(data: {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}): Promise<boolean> {
  if ('share' in navigator) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      logger.error('Error sharing', { error });
      return false;
    }
  }
  return false;
}

// Check if Web Share API is supported
export function canShare(data?: { files?: File[] }): boolean {
  if (!('share' in navigator)) {
    return false;
  }
  
  if (data?.files && !('canShare' in navigator)) {
    return false;
  }
  
  if (data?.files && (navigator as any).canShare) {
    return (navigator as any).canShare(data);
  }
  
  return true;
}

// Get device info for PWA
export function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    isOnline: navigator.onLine,
    isStandalone: isStandalone(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
    },
    pixelRatio: window.devicePixelRatio,
  };
}

// Initialize PWA features
export function initializePWA(callbacks?: {
  onOnline?: () => void;
  onOffline?: () => void;
}) {
  registerServiceWorker();
  setupOnlineOfflineHandlers(callbacks);
  
  // Initialize push notifications
  initializePushNotifications().catch(error => {
    logger.warn('Push notifications initialization failed', { error });
  });
  
  // Request persistent storage if not already persisted
  isStoragePersisted().then((persisted) => {
    if (!persisted) {
      requestPersistentStorage().then((granted) => {
        logger.info('Persistent storage request result', { granted });
      });
    }
  });
  
  // Log device info
  logger.debug('Device info', getDeviceInfo());
}