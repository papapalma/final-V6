import { useEffect } from 'react';
import { SupportedLanguage } from './types';
import { translateUiPhrase } from './filPhrases';

interface TrackedTextEntry {
  original: string;
  translated: string;
}

interface TrackedAttrEntry {
  placeholder?: { original: string; translated: string };
  title?: { original: string; translated: string };
  ariaLabel?: { original: string; translated: string };
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'SVG',
  'TEXTAREA',
]);

const SKIP_CLOSEST_SELECTOR =
  '.print-container, .printable-report-container, .print-only, [data-no-translate="true"]';

const TRANSLATABLE_ATTRS = [
  { attr: 'placeholder', key: 'placeholder' as const },
  { attr: 'title', key: 'title' as const },
  { attr: 'aria-label', key: 'ariaLabel' as const },
];

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest(SKIP_CLOSEST_SELECTOR)) return true;
  return false;
}

/**
 * Lossless, reversible portal DOM localizer mounted strictly inside DashboardLayout.
 * - Active ONLY when an authenticated user has selected 'fil' inside portal pages.
 * - Never touches public landing/login/register screens or official printable reports/slips.
 * - Stores exact original strings per node so switching back 'fil' -> 'en' restores 100% verbatim text.
 */
export function usePortalDomLocalizer(language: SupportedLanguage, enabled: boolean) {
  useEffect(() => {
    if (typeof document === 'undefined' || !enabled || language !== 'fil') {
      return;
    }

    const textMap = new Map<Text, TrackedTextEntry>();
    const attrMap = new Map<Element, TrackedAttrEntry>();
    let isApplying = false;

    const processTextNode = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || shouldSkipElement(parent)) return;

      const current = node.data;
      if (!current || !current.trim()) return;

      const existing = textMap.get(node);
      if (existing && current === existing.translated) {
        return;
      }

      const original = existing ? current : current;
      const next = translateUiPhrase(original, 'fil');
      if (next !== original) {
        textMap.set(node, { original, translated: next });
        node.data = next;
      }
    };

    const processElementAttrs = (el: Element) => {
      if (shouldSkipElement(el)) return;

      let record = attrMap.get(el);
      for (const { attr, key } of TRANSLATABLE_ATTRS) {
        const val = el.getAttribute(attr);
        if (!val || !val.trim()) continue;

        const existingAttr = record?.[key];
        if (existingAttr && val === existingAttr.translated) continue;

        const next = translateUiPhrase(val, 'fil');
        if (next !== val) {
          if (!record) {
            record = {};
            attrMap.set(el, record);
          }
          record[key] = { original: val, translated: next };
          el.setAttribute(attr, next);
        }
      }
    };

    const walkSubtree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        processTextNode(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;

      const rootEl = root as Element;
      if (shouldSkipElement(rootEl)) return;
      processElementAttrs(rootEl);

      const walker = document.createTreeWalker(
        rootEl,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
      );

      let current: Node | null = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          processTextNode(current as Text);
        } else if (current.nodeType === Node.ELEMENT_NODE) {
          processElementAttrs(current as Element);
        }
        current = walker.nextNode();
      }
    };

    const applySafely = (fn: () => void) => {
      if (isApplying) return;
      isApplying = true;
      try {
        fn();
      } finally {
        isApplying = false;
      }
    };

    applySafely(() => walkSubtree(document.body));

    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      applySafely(() => {
        for (const m of mutations) {
          if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
            processTextNode(m.target as Text);
          } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
            processElementAttrs(m.target as Element);
          } else if (m.type === 'childList') {
            m.addedNodes.forEach((added) => walkSubtree(added));
          }
        }
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });

    return () => {
      observer.disconnect();
      isApplying = true;
      for (const [node, entry] of textMap.entries()) {
        if (node.isConnected && node.data === entry.translated) {
          node.data = entry.original;
        }
      }
      for (const [el, record] of attrMap.entries()) {
        if (!el.isConnected) continue;
        for (const { attr, key } of TRANSLATABLE_ATTRS) {
          const item = record[key];
          if (item && el.getAttribute(attr) === item.translated) {
            el.setAttribute(attr, item.original);
          }
        }
      }
      textMap.clear();
      attrMap.clear();
      isApplying = false;
    };
  }, [language, enabled]);
}
