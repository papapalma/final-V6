/**
 * Web Push Subscription Management
 *
 * Handles subscribing to and managing push notifications on the frontend.
 * Coordinates with the service worker and backend API.
 */

import logger from './logger';
import api from '../services/api';

// ============================================================================
// Types
// ============================================================================

export interface PushSubscriptionData {
  id: string;
  endpoint: string;
  deviceIdentifier?: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Check if the browser supports push notifications
 */
export function isPushNotificationSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Initialize push notifications for the app
 * Call this once during app initialization
 */
export async function initializePushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    logger.warn('[PUSH] Push notifications not supported in this browser');
    return false;
  }

  try {
    // Request notification permission if not already granted
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        logger.info('[PUSH] User denied notification permission');
        return false;
      }
    }

    if (Notification.permission !== 'granted') {
      logger.info('[PUSH] Notifications not permitted');
      return false;
    }

    logger.info('[PUSH] Notifications initialized successfully');
    return true;
  } catch (error) {
    logger.error('[PUSH] Error initializing push notifications', { error });
    return false;
  }
}

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Subscribe a device to push notifications
 * Returns subscription ID on success
 */
export async function subscribeToPushNotifications(): Promise<string | null> {
  try {
    if (!isPushNotificationSupported()) {
      logger.warn('[PUSH] Push notifications not supported');
      return null;
    }

    // Request notification permission
    if (Notification.permission !== 'granted') {
      logger.warn('[PUSH] Notification permission not granted');
      return null;
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Fetch VAPID public key from backend via authenticated API client
    const vapidResponse = await api.get<{ vapidKey: string }>('/push-subscriptions/vapid');
    const vapidKey = vapidResponse.data?.vapidKey;

    if (!vapidKey) {
      logger.error('[PUSH] VAPID key not available from server');
      return null;
    }

    // Reuse existing browser push subscription when available, otherwise subscribe
    let pushSubscription = await registration.pushManager.getSubscription();
    if (!pushSubscription) {
      pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
    }

    // Extract subscription keys
    const subscription = pushSubscription.toJSON();
    if (!subscription.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
      logger.error('[PUSH] Invalid push subscription object');
      return null;
    }

    // Register subscription with backend API (includes Bearer auth & tenant context)
    const registerResponse = await api.post<PushSubscriptionData>('/push-subscriptions', {
      endpoint: subscription.endpoint,
      keys: {
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh,
      },
      deviceIdentifier: getDeviceIdentifier(),
      userAgent: navigator.userAgent,
    });

    const id = registerResponse.data?.id;
    if (!id) {
      logger.error('[PUSH] Backend did not return subscription ID');
      return null;
    }

    logger.info('[PUSH] Device subscribed to push notifications', {
      subscriptionId: id,
      endpoint: subscription.endpoint.substring(0, 50) + '...',
    });

    return id;
  } catch (error: any) {
    logger.error('[PUSH] Error subscribing to push notifications', {
      error: error?.message,
      status: error?.status ?? error?.response?.status,
    });
    return null;
  }
}

/**
 * Unsubscribe a device from push notifications
 */
export async function unsubscribeFromPushNotifications(subscriptionId: string): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      return false;
    }

    // Remove subscription from service worker
    const registration = await navigator.serviceWorker.ready;
    const pushSubscription = await registration.pushManager.getSubscription();

    if (pushSubscription) {
      await pushSubscription.unsubscribe();
      logger.debug('[PUSH] Unsubscribed from browser push manager');
    }

    // Notify backend
    await api.delete(`/push-subscriptions/${subscriptionId}`);

    logger.info('[PUSH] Unsubscribed from push notifications', { subscriptionId });
    return true;
  } catch (error: any) {
    logger.error('[PUSH] Error unsubscribing from push notifications', {
      error: error?.message,
      subscriptionId,
    });
    return false;
  }
}

/**
 * Get all push subscriptions for the current user
 */
export async function getUserPushSubscriptions(): Promise<PushSubscriptionData[]> {
  try {
    const response = await api.get<PushSubscriptionData[]>('/push-subscriptions');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    logger.error('[PUSH] Error fetching push subscriptions', {
      error: error?.message,
      status: error?.status ?? error?.response?.status,
    });
    return [];
  }
}

/**
 * Check if the current device has an active push subscription
 */
export async function hasActivePushSubscription(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const pushSubscription = await registration.pushManager.getSubscription();

    return pushSubscription !== null;
  } catch (error) {
    logger.error('[PUSH] Error checking push subscription', { error });
    return false;
  }
}

/**
 * Get the current device's push subscription endpoint
 */
export async function getCurrentDevicePushEndpoint(): Promise<string | null> {
  try {
    if (!isPushNotificationSupported()) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const pushSubscription = await registration.pushManager.getSubscription();

    return pushSubscription?.endpoint || null;
  } catch (error) {
    logger.error('[PUSH] Error getting push endpoint', { error });
    return null;
  }
}

/**
 * Sync push subscriptions - subscribe if permission granted, otherwise cleanup
 * This should be called when notification permissions change
 */
export async function syncPushSubscriptions(): Promise<void> {
  try {
    if (!isPushNotificationSupported()) {
      return;
    }

    if (Notification.permission === 'granted') {
      // Ensure the browser push subscription is registered in the backend DB
      const [hasBrowserSub, serverSubs] = await Promise.all([
        hasActivePushSubscription(),
        getUserPushSubscriptions(),
      ]);
      const hasActiveServerSub = serverSubs.some((s) => s.isActive);

      if (!hasBrowserSub || !hasActiveServerSub) {
        logger.info('[PUSH] Syncing: registering push subscription with backend');
        await subscribeToPushNotifications();
      }
    } else if (Notification.permission === 'denied') {
      // Cleanup: unsubscribe if permission was revoked
      logger.info('[PUSH] Syncing: unsubscribing due to denied permission');
      const subscriptions = await getUserPushSubscriptions();
      for (const sub of subscriptions) {
        if (sub.isActive) {
          await unsubscribeFromPushNotifications(sub.id);
        }
      }
    }
  } catch (error) {
    logger.error('[PUSH] Error syncing push subscriptions', { error });
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert VAPID public key from base64url to Uint8Array
 * Required for PushManager.subscribe()
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Generate a device identifier for distinguishing multiple devices per user
 */
export function getDeviceIdentifier(): string {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;

  // Create a simple device identifier from browser properties
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const browser = getBrowserName(userAgent);

  return `${browser}-${platform}-${deviceType}`;
}

/**
 * Extract browser name from user agent
 */
export function getBrowserName(userAgent: string): string {
  if (userAgent.includes('Edg') || userAgent.includes('Edge')) return 'edge';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edge') && !userAgent.includes('Edg')) return 'chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'safari';
  if (userAgent.includes('Firefox')) return 'firefox';
  return 'unknown';
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    logger.warn('[PUSH] Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    logger.warn('[PUSH] User has previously denied notifications');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';

    if (granted) {
      logger.info('[PUSH] User granted notification permission');
      // Auto-subscribe if permission granted
      await subscribeToPushNotifications();
    } else {
      logger.info('[PUSH] User denied notification permission');
    }

    return granted;
  } catch (error) {
    logger.error('[PUSH] Error requesting notification permission', { error });
    return false;
  }
}

/**
 * Show a deduplicated local browser notification (via SW or Notification API)
 * while the portal is open, without repeating the same tag twice.
 */
export async function showLocalAttendanceReminder(
  title: string,
  body: string,
  tag: string,
  url: string = '/trainee/attendance'
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const dedupeKey = `bmdc-local-notif:${tag}`;
  try {
    if (window.localStorage.getItem(dedupeKey)) {
      return false;
    }
    window.localStorage.setItem(dedupeKey, new Date().toISOString());
  } catch {
    // Proceed even if storage is restricted
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: '/icons/bmdc-logo-192x192.png',
          badge: '/icons/bmdc-logo-72x72.png',
          tag,
          data: { url },
        });
        return true;
      }
    }

    const notif = new Notification(title, {
      body,
      icon: '/icons/bmdc-logo-192x192.png',
      tag,
    });
    notif.onclick = () => {
      window.focus();
      if (url && window.location.pathname !== url) {
        window.location.assign(url);
      }
    };
    return true;
  } catch (error) {
    logger.warn('[PUSH] Failed showing local attendance reminder', { error, tag });
    return false;
  }
}
