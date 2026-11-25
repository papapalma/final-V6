import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { api, getFileUrl } from '../services/api';
import { useAuth } from './AuthContext';

export const CMS_STORAGE_KEY = 'bmdc-cms-settings';
const DEFAULT_COMPANY_NAME = 'Bongabong Manpower Development Center';
const DEFAULT_SHORT_NAME = 'BMDC';
const DEFAULT_TAGLINE = 'Training Center';
const DEFAULT_LOGO_URL = '/icons/bmdc-logo-192x192.png';
const DEFAULT_FAVICON = '/icons/bmdc-logo-192x192.png';
const DEFAULT_TOUCH_ICON = '/icons/bmdc-logo-180x180.png';

export interface BrandingState {
  rawLogo: string;
  logoUrl: string | null;
  companyName: string;
  tagline: string;
  isLoaded: boolean;
}

interface BrandingContextValue extends BrandingState {
  refreshBranding: (tenantId?: string) => Promise<void>;
  applyBrandingContent: (content: any) => void;
}

// Module-level cache so synchronous utilities (e.g. jsPDF exports) always see the latest branding
let cachedLogoDataUrl: string | null = null;
let cachedLogoDataSource: string | null = null;
let latestBrandingState: BrandingState = {
  rawLogo: DEFAULT_LOGO_URL,
  logoUrl: DEFAULT_LOGO_URL,
  companyName: DEFAULT_COMPANY_NAME,
  tagline: DEFAULT_TAGLINE,
  isLoaded: false,
};

function unwrapText(val: unknown, fallback: string): string {
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (val && typeof val === 'object' && 'value' in val) {
    const inner = (val as { value?: unknown }).value;
    if (typeof inner === 'string' && inner.trim()) return inner.trim();
  }
  return fallback;
}

export function extractBrandingContent(payload: any): any {
  if (!payload || typeof payload !== 'object') return null;
  return payload.settingsData?.content || payload.content || payload;
}

export function normalizeBranding(rawContent: any, isLoaded = true): BrandingState {
  const content = extractBrandingContent(rawContent) || {};
  const rawLogo = typeof content?.appearance?.logo === 'string' ? content.appearance.logo.trim() : '';
  const logoUrl = rawLogo ? getFileUrl(rawLogo) : DEFAULT_LOGO_URL;
  const companyName = unwrapText(content?.footer?.companyName, DEFAULT_COMPANY_NAME);
  const tagline = unwrapText(content?.footer?.tagline, DEFAULT_TAGLINE);

  return {
    rawLogo: rawLogo || DEFAULT_LOGO_URL,
    logoUrl,
    companyName,
    tagline,
    isLoaded,
  };
}

function readLocalBranding(): BrandingState {
  try {
    const raw = localStorage.getItem(CMS_STORAGE_KEY);
    if (raw) {
      return normalizeBranding(JSON.parse(raw), false);
    }
  } catch {
    // Ignore storage/parse errors in restricted or test environments
  }
  return {
    rawLogo: DEFAULT_LOGO_URL,
    logoUrl: DEFAULT_LOGO_URL,
    companyName: DEFAULT_COMPANY_NAME,
    tagline: DEFAULT_TAGLINE,
    isLoaded: false,
  };
}

function persistLocalBranding(rawContent: any): void {
  try {
    const content = extractBrandingContent(rawContent);
    if (!content) return;
    localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(content));
  } catch {
    // Ignore storage quota/availability errors
  }
}

function updateDocumentIcons(logoUrl: string | null): void {
  if (typeof document === 'undefined' || !document.head) return;

  const iconHref = logoUrl || DEFAULT_FAVICON;
  let iconLink = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    document.head.appendChild(iconLink);
  }
  if (logoUrl) {
    iconLink.removeAttribute('type');
  } else {
    iconLink.type = 'image/png';
  }
  iconLink.href = iconHref;

  const touchHref = logoUrl || DEFAULT_TOUCH_ICON;
  const touchLinks = document.head.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  touchLinks.forEach((link) => {
    link.href = touchHref;
  });
}

function preloadLogoDataUrl(logoUrl: string | null): void {
  if (!logoUrl) {
    cachedLogoDataUrl = null;
    cachedLogoDataSource = null;
    return;
  }
  if (logoUrl.startsWith('data:image/')) {
    cachedLogoDataUrl = logoUrl;
    cachedLogoDataSource = logoUrl;
    return;
  }
  if (cachedLogoDataSource === logoUrl && cachedLogoDataUrl) {
    return;
  }
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return;
  }

  cachedLogoDataSource = logoUrl;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const maxDim = 256;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      canvas.width = Math.max(1, Math.round((img.naturalWidth || 64) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || 64) * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cachedLogoDataUrl = canvas.toDataURL('image/png');
      }
    } catch {
      // Canvas tainted by CORS or unsupported in jsdom; PDF falls back gracefully
      cachedLogoDataUrl = null;
    }
  };
  img.onerror = () => {
    if (cachedLogoDataSource === logoUrl) {
      cachedLogoDataUrl = null;
    }
  };
  img.src = logoUrl;
}

export function getCachedBranding(): BrandingState {
  if (latestBrandingState.isLoaded || latestBrandingState.logoUrl) {
    return latestBrandingState;
  }
  return readLocalBranding();
}

export function getCachedLogoDataUrl(): string | null {
  return cachedLogoDataUrl;
}

export function getBrandInitials(companyName?: string): string {
  const name = (companyName || '').trim();
  if (!name || name.toLowerCase().includes('bongabong')) return DEFAULT_SHORT_NAME;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.slice(0, 4).map((w) => w[0]).join('').toUpperCase();
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const versionRef = useRef(0);
  const [branding, setBranding] = useState<BrandingState>(() => {
    const initial = readLocalBranding();
    latestBrandingState = initial;
    return initial;
  });

  const commitBranding = useCallback((content: any, persist = true) => {
    const next = normalizeBranding(content, true);
    latestBrandingState = next;
    setBranding(next);
    if (persist) {
      persistLocalBranding(content);
    }
    updateDocumentIcons(next.logoUrl);
    preloadLogoDataUrl(next.logoUrl);
  }, []);

  const refreshBranding = useCallback(async (tenantId?: string) => {
    const reqVersion = ++versionRef.current;
    try {
      const params = tenantId ? { tenantId } : undefined;
      let response: any = null;
      try {
        response = await api.get('/cms-settings', params);
      } catch {
        response = await api.get('/landing-content', params);
      }
      if (reqVersion !== versionRef.current) return;
      if (response?.success && response?.data) {
        commitBranding(response.data, true);
      } else {
        setBranding((prev) => {
          const next = { ...prev, isLoaded: true };
          latestBrandingState = next;
          return next;
        });
      }
    } catch {
      if (reqVersion !== versionRef.current) return;
      // Keep cached/localStorage branding on offline or network hiccup
      setBranding((prev) => {
        const next = { ...prev, isLoaded: true };
        latestBrandingState = next;
        return next;
      });
    }
  }, [commitBranding]);

  const applyBrandingContent = useCallback((content: any) => {
    versionRef.current += 1;
    commitBranding(content, true);
  }, [commitBranding]);

  // Sync icons & PDF logo cache on initial mount from localStorage cache
  useEffect(() => {
    updateDocumentIcons(branding.logoUrl);
    preloadLogoDataUrl(branding.logoUrl);
  }, [branding.logoUrl]);

  // Fetch live branding on mount and whenever authenticated tenant changes
  useEffect(() => {
    refreshBranding(user?.tenantId || undefined);
  }, [user?.tenantId, refreshBranding]);

  // Keep multiple open browser tabs in sync when logo is updated in another tab
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CMS_STORAGE_KEY && e.newValue) {
        try {
          commitBranding(JSON.parse(e.newValue), false);
        } catch {
          // Ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [commitBranding]);

  return (
    <BrandingContext.Provider
      value={{
        ...branding,
        refreshBranding,
        applyBrandingContent,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (ctx) return ctx;
  const fallback = readLocalBranding();
  return {
    ...fallback,
    refreshBranding: async () => {},
    applyBrandingContent: () => {},
  };
}
