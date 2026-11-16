/**
 * Performance Logger Utility
 * 
 * Tracks and logs page performance metrics for debugging and analysis.
 * Stores metrics in localStorage for baseline comparison and regression detection.
 */

export interface PerformanceMetrics {
  pagePath: string;
  timestamp: number;
  navigationTiming?: {
    dns: number;
    tcp: number;
    ttfb: number;
    domInteractive: number;
    domComplete: number;
    pageLoadTime: number;
  };
  vitals?: {
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
  };
  resourceTiming?: {
    jsSize: number;
    cssSize: number;
    imageSize: number;
    totalSize: number;
  };
}

const STORAGE_KEY = 'performance_metrics';
const MAX_STORED_METRICS = 50; // Keep last 50 page loads

class PerformanceLogger {
  private metrics: PerformanceMetrics[] = [];
  private currentPagePath: string = '';

  /**
   * Initialize performance logger and load previous metrics from storage
   */
  initialize() {
    this.loadMetricsFromStorage();
    this.captureNavigationTiming();
  }

  /**
   * Set the current page path being measured
   */
  setPagePath(path: string) {
    this.currentPagePath = path;
  }

  /**
   * Capture navigation timing metrics from the Performance API
   */
  private captureNavigationTiming() {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (!navigation) return;

      const metrics: PerformanceMetrics = {
        pagePath: this.currentPagePath || window.location.pathname,
        timestamp: Date.now(),
        navigationTiming: {
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ttfb: navigation.responseStart - navigation.requestStart,
          domInteractive: navigation.domInteractive - ((navigation as any).navigationStart || 0),
          domComplete: navigation.domComplete - ((navigation as any).navigationStart || 0),
          pageLoadTime: navigation.loadEventEnd - ((navigation as any).navigationStart || 0),
        },
      };

      this.metrics.push(metrics);
    } catch (error) {
      console.error('Error capturing navigation timing:', error);
    }
  }

  /**
   * Add vitals metrics to the current page measurement
   */
  addVitals(vitals: { fcp?: number; lcp?: number; fid?: number; cls?: number }) {
    const lastMetric = this.metrics[this.metrics.length - 1];
    if (lastMetric) {
      lastMetric.vitals = vitals;
    }
  }

  /**
   * Capture resource timing metrics
   */
  captureResourceTiming() {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      let jsSize = 0,
        cssSize = 0,
        imageSize = 0;

      resources.forEach((resource) => {
        const size = resource.transferSize || 0;
        if (resource.name.includes('.js')) jsSize += size;
        else if (resource.name.includes('.css')) cssSize += size;
        else if (/\.(png|jpg|gif|svg|webp)/.test(resource.name)) imageSize += size;
      });

      const lastMetric = this.metrics[this.metrics.length - 1];
      if (lastMetric) {
        lastMetric.resourceTiming = {
          jsSize,
          cssSize,
          imageSize,
          totalSize: jsSize + cssSize + imageSize,
        };
      }
    } catch (error) {
      console.error('Error capturing resource timing:', error);
    }
  }

  /**
   * Get baseline metrics (average of stored metrics)
   */
  getBaseline(): PerformanceMetrics | null {
    if (this.metrics.length === 0) return null;

    const avgMetrics = this.metrics.reduce(
      (acc, metric) => {
        if (metric.navigationTiming) {
          if (!acc.navigationTiming) {
            acc.navigationTiming = { ...metric.navigationTiming };
          } else {
            Object.keys(metric.navigationTiming).forEach((key) => {
              acc.navigationTiming![key as keyof typeof acc.navigationTiming] +=
                metric.navigationTiming![key as keyof typeof metric.navigationTiming];
            });
          }
        }
        return acc;
      },
      {} as PerformanceMetrics
    );

    if (avgMetrics.navigationTiming) {
      const count = this.metrics.length;
      Object.keys(avgMetrics.navigationTiming).forEach((key) => {
        avgMetrics.navigationTiming![key as keyof typeof avgMetrics.navigationTiming] /= count;
      });
    }

    return avgMetrics;
  }

  /**
   * Get metrics for a specific page path
   */
  getMetricsForPage(path: string): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.pagePath === path);
  }

  /**
   * Generate a performance summary for the current session
   */
  generateSummary(): string {
    const summary = [
      '\n╔═══════════════════════════════════════════════╗',
      '║       Performance Metrics Summary            ║',
      '╚═══════════════════════════════════════════════╝\n',
    ];

    if (this.metrics.length === 0) {
      summary.push('No metrics collected yet.\n');
      return summary.join('\n');
    }

    const latest = this.metrics[this.metrics.length - 1];
    summary.push(`Page: ${latest.pagePath}`);
    summary.push(`Timestamp: ${new Date(latest.timestamp).toISOString()}\n`);

    if (latest.navigationTiming) {
      summary.push('Navigation Timing:');
      summary.push(`  DNS Lookup: ${latest.navigationTiming.dns.toFixed(2)}ms`);
      summary.push(`  TCP Connection: ${latest.navigationTiming.tcp.toFixed(2)}ms`);
      summary.push(`  TTFB: ${latest.navigationTiming.ttfb.toFixed(2)}ms`);
      summary.push(`  DOM Interactive: ${latest.navigationTiming.domInteractive.toFixed(2)}ms`);
      summary.push(`  DOM Complete: ${latest.navigationTiming.domComplete.toFixed(2)}ms`);
      summary.push(`  Page Load Time: ${latest.navigationTiming.pageLoadTime.toFixed(2)}ms\n`);
    }

    if (latest.vitals) {
      summary.push('Web Vitals:');
      if (latest.vitals.fcp) summary.push(`  FCP: ${latest.vitals.fcp.toFixed(2)}ms`);
      if (latest.vitals.lcp) summary.push(`  LCP: ${latest.vitals.lcp.toFixed(2)}ms`);
      if (latest.vitals.fid) summary.push(`  FID: ${latest.vitals.fid.toFixed(2)}ms`);
      if (latest.vitals.cls) summary.push(`  CLS: ${latest.vitals.cls.toFixed(3)}`);
      summary.push('');
    }

    if (latest.resourceTiming) {
      summary.push('Resource Sizes:');
      summary.push(`  JS: ${(latest.resourceTiming.jsSize / 1024).toFixed(2)}KB`);
      summary.push(`  CSS: ${(latest.resourceTiming.cssSize / 1024).toFixed(2)}KB`);
      summary.push(`  Images: ${(latest.resourceTiming.imageSize / 1024).toFixed(2)}KB`);
      summary.push(`  Total: ${(latest.resourceTiming.totalSize / 1024).toFixed(2)}KB\n`);
    }

    const baseline = this.getBaseline();
    if (baseline) {
      summary.push('Baseline (Average of all collected metrics):');
      if (baseline.navigationTiming) {
        summary.push(`  Avg Page Load: ${baseline.navigationTiming.pageLoadTime.toFixed(2)}ms\n`);
      }
    }

    summary.push('═══════════════════════════════════════════════\n');

    return summary.join('\n');
  }

  /**
   * Save metrics to localStorage
   */
  saveMetricsToStorage() {
    try {
      // Keep only the most recent MAX_STORED_METRICS
      const metricsToStore = this.metrics.slice(-MAX_STORED_METRICS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metricsToStore));
    } catch (error) {
      console.error('Error saving metrics to storage:', error);
    }
  }

  /**
   * Load metrics from localStorage
   */
  private loadMetricsFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.metrics = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading metrics from storage:', error);
      this.metrics = [];
    }
  }

  /**
   * Clear all stored metrics
   */
  clearMetrics() {
    this.metrics = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Export metrics as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Get all collected metrics
   */
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
}

// Export singleton instance
export const performanceLogger = new PerformanceLogger();
