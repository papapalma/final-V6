/**
 * Lazy Loading Utilities
 * 
 * Provides utilities for lazy-loading page components with Suspense boundaries.
 * Includes loading skeleton for better UX during code chunk loading.
 */

import { lazy, Suspense, ReactNode, ComponentType } from 'react';
import { Skeleton } from '../components/ui/skeleton';

/**
 * Loading fallback component - minimal skeleton to show while code is loading
 */
function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

/**
 * Wraps a lazily-loaded component with a Suspense boundary
 * @param Component The lazy-loaded component
 * @param fallback Optional custom fallback component (defaults to PageLoadingSkeleton)
 */
export function withSuspense<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode
) {
  return function LazyComponent(props: P) {
    return (
      <Suspense fallback={fallback || <PageLoadingSkeleton />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

const CHUNK_RELOAD_STORAGE_KEY = 'bmdc-chunk-reload-ts';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Outdated Optimize Dep/i.test(message)
  );
}

/**
 * Retry a dynamic page import once on chunk-load failures (e.g. Vite dep
 * re-optimization or freshly deployed hashed bundles) before falling back to a
 * single cooldown-guarded page reload.
 */
export async function importWithChunkRetry<T>(importFn: () => Promise<T>): Promise<T> {
  try {
    return await importFn();
  } catch (firstError) {
    if (!isChunkLoadError(firstError)) {
      throw firstError;
    }

    try {
      return await importFn();
    } catch (retryError) {
      if (typeof window !== 'undefined' && isChunkLoadError(retryError)) {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || '0');
        const now = Date.now();
        if (!lastReload || now - lastReload > CHUNK_RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
          window.location.reload();
          // Keep Suspense pending while the browser navigates
          return new Promise<T>(() => {});
        }
      }
      throw retryError;
    }
  }
}

/**
 * Lazy load a page component
 * @param importFn Dynamic import function
 */
export function lazyPage<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
) {
  const Component = lazy(() => importWithChunkRetry(importFn));
  return withSuspense(Component);
}

/**
 * Lazy load a component
 * @param importFn Dynamic import function
 */
export function lazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
) {
  return lazy(importFn);
}

export { PageLoadingSkeleton };
