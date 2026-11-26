import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import authService from '../services/authService';
import { EN_DICTIONARY } from '../i18n/en';
import { FIL_DICTIONARY } from '../i18n/fil';
import { interpolateParams, translateUiPhrase } from '../i18n/filPhrases';
import { SupportedLanguage, TranslationDictionary } from '../i18n/types';
import { logger } from '../utils/logger';

const USER_LANG_KEY_PREFIX = 'bmdc-lang:';
const USER_LANG_DIRTY_PREFIX = 'bmdc-lang-dirty:';

function normalizeLanguage(value: unknown): SupportedLanguage | null {
  if (value === 'en' || value === 'fil') return value;
  return null;
}

function readStoredUserLanguage(userId: string): SupportedLanguage | null {
  try {
    return normalizeLanguage(localStorage.getItem(`${USER_LANG_KEY_PREFIX}${userId}`));
  } catch {
    return null;
  }
}

function writeStoredUserLanguage(userId: string, lang: SupportedLanguage): void {
  try {
    localStorage.setItem(`${USER_LANG_KEY_PREFIX}${userId}`, lang);
  } catch {
    // Storage unavailable; continue in memory
  }
}

function isUserLanguageDirty(userId: string): boolean {
  try {
    return localStorage.getItem(`${USER_LANG_DIRTY_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

function setUserLanguageDirty(userId: string, dirty: boolean): void {
  try {
    if (dirty) {
      localStorage.setItem(`${USER_LANG_DIRTY_PREFIX}${userId}`, '1');
    } else {
      localStorage.removeItem(`${USER_LANG_DIRTY_PREFIX}${userId}`);
    }
  } catch {
    // Ignore storage errors
  }
}

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends Record<string, any>
    ? `${K}.${NestedKeyOf<T[K]>}`
    : K;
}[keyof T & string];

export type TranslationKey = NestedKeyOf<TranslationDictionary>;

function lookupDictionaryKey(
  dict: TranslationDictionary,
  key: TranslationKey
): string | undefined {
  const parts = key.split('.');
  let cursor: any = dict;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

export interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tx: (englishPhrase: string, params?: Record<string, string | number>) => string;
  isSyncing: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const FALLBACK_CONTEXT: LanguageContextType = {
  language: 'en',
  setLanguage: async () => {},
  toggleLanguage: async () => {},
  t: (key, params) => {
    const raw = lookupDictionaryKey(EN_DICTIONARY, key) ?? key;
    return interpolateParams(raw, params);
  },
  tx: (phrase, params) => translateUiPhrase(phrase, 'en', params),
  isSyncing: false,
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, updateUserPreferredLanguage } = useAuth();
  const userId = isAuthenticated && user?.id ? user.id : null;
  const serverLang = normalizeLanguage(user?.preferredLanguage);

  const [userLanguage, setUserLanguage] = useState<SupportedLanguage>(() => {
    if (!userId) return 'en';
    const cached = readStoredUserLanguage(userId);
    if (cached) return cached;
    return serverLang ?? 'en';
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Reconcile language whenever the active authenticated user changes or server preference arrives
  useEffect(() => {
    if (!userId) {
      setUserLanguage('en');
      return;
    }

    const cached = readStoredUserLanguage(userId);
    const dirty = isUserLanguageDirty(userId);

    if (dirty && cached) {
      setUserLanguage(cached);
      // Sync pending offline preference to backend
      authService
        .updatePreferredLanguage(cached)
        .then(() => {
          setUserLanguageDirty(userId, false);
          updateUserPreferredLanguage?.(cached);
        })
        .catch(() => {
          // Remain dirty until online
        });
      return;
    }

    if (serverLang) {
      // If user already picked a cached value locally and server hasn't migrated yet,
      // prefer cached only when server returned default 'en' and cached was explicitly stored;
      // wait: serverLang is authoritative when clean, so sync local cache to serverLang!
      // Exception: if server DB column isn't migrated (always 'en') and local cache exists,
      // we mark dirty false only when persisted === true on PATCH!
      setUserLanguage(serverLang);
      writeStoredUserLanguage(userId, serverLang);
      return;
    }

    if (cached) {
      setUserLanguage(cached);
      return;
    }

    setUserLanguage('en');
  }, [userId, serverLang]);

  // Effective runtime language: strictly 'en' when unauthenticated (public landing/login/register)
  const language: SupportedLanguage = userId ? userLanguage : 'en';

  // Sync <html lang="..."> attribute for accessibility & screen readers ('tl' is standard BCP-47/HTML code for Tagalog/Filipino)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'fil' ? 'tl' : 'en';
    }
  }, [language]);

  // Retry syncing dirty preference when browser reconnects online
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
    const handleOnline = () => {
      if (!isUserLanguageDirty(userId)) return;
      const pending = readStoredUserLanguage(userId);
      if (!pending) return;
      authService
        .updatePreferredLanguage(pending)
        .then((res) => {
          if (res?.persisted !== false) {
            setUserLanguageDirty(userId, false);
          }
          updateUserPreferredLanguage?.(pending);
        })
        .catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId, updateUserPreferredLanguage]);

  const setLanguage = useCallback(
    async (nextLang: SupportedLanguage) => {
      if (!userId) return;
      // 0ms optimistic update + local per-user persistence
      setUserLanguage(nextLang);
      writeStoredUserLanguage(userId, nextLang);
      setUserLanguageDirty(userId, true);
      updateUserPreferredLanguage?.(nextLang);

      setIsSyncing(true);
      try {
        const res = await authService.updatePreferredLanguage(nextLang);
        // Only clear dirty flag when DB actually persisted the column (so pre-migration local cache stays authoritative!)
        if (res?.persisted !== false) {
          setUserLanguageDirty(userId, false);
        }
      } catch (error) {
        logger.debug('[LanguageContext] Saved language offline in user cache; will sync when online', {
          userId,
          nextLang,
          error,
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [userId, updateUserPreferredLanguage]
  );

  const toggleLanguage = useCallback(async () => {
    const next: SupportedLanguage = language === 'en' ? 'fil' : 'en';
    await setLanguage(next);
  }, [language, setLanguage]);

  const activeDictionary = language === 'fil' ? FIL_DICTIONARY : EN_DICTIONARY;

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const template =
        lookupDictionaryKey(activeDictionary, key) ??
        lookupDictionaryKey(EN_DICTIONARY, key) ??
        key;
      return interpolateParams(template, params);
    },
    [activeDictionary]
  );

  const tx = useCallback(
    (englishPhrase: string, params?: Record<string, string | number>): string => {
      return translateUiPhrase(englishPhrase, language, params);
    },
    [language]
  );

  const contextValue = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      tx,
      isSyncing,
    }),
    [language, setLanguage, toggleLanguage, t, tx, isSyncing]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    return FALLBACK_CONTEXT;
  }
  return context;
}
