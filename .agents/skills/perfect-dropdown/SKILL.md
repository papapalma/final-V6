---
name: perfect-dropdown
description: Design, review, and implement dropdowns and select components adhering to the 5 golden rules: 48px touch targets with obvious triggers, edge-flipping without viewport clipping, full keyboard & ARIA accessibility, automatic search filtering for 10+ items, and snappy 150ms micro-animations.
---

# Perfect Dropdown Skill

A specialized standard and implementation guide for building and auditing high-quality, accessible, rock-solid dropdown menus, select boxes, and comboboxes.

Every dropdown built or audited with this skill must satisfy all **5 Golden Rules**.

---

## The 5 Golden Rules

| # | Rule | Requirement | Core Spec |
|---|------|-------------|-----------|
| **1** | **Make it Clickable** | Obvious trigger, 48px touch target, clear caret, hover & focus states | Minimum 48px touch target on mobile/coarse pointers, rotating SVG caret, high-contrast borders and active states |
| **2** | **Flip on Edge** | Detects bottom collision and flips upward; never clips items | Collision detection against viewport boundaries, dynamic `max-height`, `overscroll-behavior: contain` |
| **3** | **Keyboard Always** | Non-negotiable full keyboard navigation & ARIA compliance | `combobox`/`listbox` pattern, `ArrowUp`/`ArrowDown`, `Enter`/`Space`, `Escape`, `Home`/`End`, roving tabindex |
| **4** | **Pass 10+ Items Add Search** | Automatic search input when item count $\ge 10$ | Sticky filter input, auto-focus on open, instant client-side filtering, polite screen reader announcement |
| **5** | **Hit 150ms** | Micro-animation capped at exactly 150ms | Scale `0.97` to `1` + Fade `0` to `1`, `cubic-bezier(0.16, 1, 0.3, 1)`, respect `prefers-reduced-motion` |

---

## Rule 1: Make It Clickable (Affordance & 48px Touch Target)

A dropdown that is hard to tap or unclear about its state fails before it even opens.

### 1.1 Touch Target Sizing (48px Rule)
- On touch devices and coarse pointers (`@media (pointer: coarse)`), the trigger must have a minimum interactive dimension of **48px $\times$ 48px** (WCAG 2.5.5 / 2.5.8 & Apple Human Interface Guidelines).
- On desktop pointers, a visual height of 38px–42px is permissible provided the hit area or container respects generous padding.
```css
/* Ensure minimum touch target on coarse pointers */
.dropdown-trigger {
  min-height: 40px;
  padding: 8px 14px;
}

@media (pointer: coarse) {
  .dropdown-trigger {
    min-height: 48px;
    padding: 12px 16px;
  }
}
```

### 1.2 Visual Affordance & Caret Icon
- **Clear Caret:** An SVG chevron indicator placed at the end of the trigger.
- **State Transition:** The chevron rotates 180° when the dropdown opens:
  ```css
  .dropdown-caret {
    transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .dropdown-trigger[aria-expanded="true"] .dropdown-caret {
    transform: rotate(180deg);
  }
  ```
- **States:**
  - **Hover:** Distinct background shift (`bg-slate-50` or `border-slate-400`).
  - **Focus-visible:** 2px high-contrast outline with 2px offset (`outline: 2px solid var(--accent); outline-offset: 2px;`). Never hide outline without custom focus indicator.
  - **Active/Pressed:** Subtle scale (`scale(0.99)`) or background tint.
  - **Truncation:** Selected label must have `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` so long text never pushes the caret outside the trigger box.

---

## Rule 2: Flip on Edge (Collision Detection & Never Clip)

A dropdown must never push options below the viewport cutoff or get cut off by overflow containers.

### 2.1 Viewport Boundary Detection & Flipping
- When space below the trigger is insufficient (`triggerRect.bottom + menuHeight > window.innerHeight`), flip orientation so the dropdown renders **above** the trigger (`top: auto; bottom: 100%;`).
- Maintain a minimum 8px safety margin from the screen edge.
- Preferred modern CSS solution: Native Anchor Positioning or `@position-try`:
  ```css
  .dropdown-menu {
    position-anchor: --dropdown-trigger;
    top: anchor(bottom);
    position-try-fallbacks: flip-block;
  }
  ```
- Standard JS / Floating-UI fallback logic:
  ```javascript
  function calculatePlacement(triggerEl, menuEl) {
    const triggerRect = triggerEl.getBoundingClientRect();
    const menuHeight = menuEl.offsetHeight;
    const viewportHeight = window.innerHeight;
    const margin = 8;

    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    // Flip up if bottom overflows and above has more space
    const openUpward = spaceBelow < menuHeight + margin && spaceAbove > spaceBelow;

    return {
      openUpward,
      maxAvailableHeight: openUpward ? spaceAbove - margin : spaceBelow - margin
    };
  }
  ```

### 2.2 Sizing & Scroll Containment
- Always enforce bounded height: `max-height: min(var(--available-height, 320px), 320px)`.
- Enable smooth vertical scrolling: `overflow-y: auto`.
- Prevent accidental background scrolling while scrolling options: `overscroll-behavior: contain`.
- Ensure the last item always has bottom padding (`padding-bottom: 6px`) so it never hugs the container boundary.

---

## Rule 3: Keyboard Always (Non-Negotiable Access)

Every interactive dropdown must be fully operable without a mouse.

### 3.1 ARIA Semantics
- **Trigger:**
  - `role="combobox"`
  - `aria-haspopup="listbox"`
  - `aria-expanded="true|false"`
  - `aria-controls="{menu-id}"`
- **Menu Container:**
  - `role="listbox"`
  - `id="{menu-id}"`
  - `aria-labelledby="{trigger-id}"`
  - `tabindex="-1"`
- **Options:**
  - `role="option"`
  - `aria-selected="true|false"`
  - `id="{option-id}"`

### 3.2 Keyboard Interaction Map

| Key | When Trigger Focused | When Menu / Item Focused | When Search Focused |
|-----|----------------------|--------------------------|---------------------|
| `Enter` / `Space` | Opens menu, highlights 1st / selected option | Selects option, closes menu, focuses trigger | If option highlighted: selects & closes |
| `ArrowDown` | Opens menu, highlights 1st option | Moves highlight to next option | Moves highlight to 1st/next option |
| `ArrowUp` | Opens menu, highlights last option | Moves highlight to previous option | Moves highlight to previous option |
| `Home` | - | Jumps highlight to first option | Caret to start of search text |
| `End` | - | Jumps highlight to last option | Caret to end of search text |
| `Escape` | Closes menu (if open) | Closes menu, immediately returns focus to trigger | Closes menu, returns focus to trigger |
| `Tab` | Moves focus to next DOM element | Closes menu, moves focus to next DOM element | Closes menu, moves focus to next DOM element |
| Type-ahead (`a-z`) | Buffer characters & jump to match | Buffer characters & jump to match | Types into search input |

### 3.3 Focus Restoration
When the dropdown closes (via `Escape`, selection, or outside click), focus **must** return to the trigger element (`triggerEl.focus()`). Never lose focus to `document.body`.

---

## Rule 4: Pass 10+ Items Add Search (Auto-filtering)

When an options list reaches 10 or more items, visual scanning degrades. A search filter becomes mandatory.

### 4.1 Activation Threshold
- If `options.length >= 10`: Automatically render a sticky filter search bar at the very top of the listbox.
- If `options.length < 10`: Render clean list without extra input overhead.

### 4.2 Behavior Requirements
- **Autofocus:** When opened via keyboard or click on a 10+ list, immediately place focus into the search input.
- **Sticky Header:** The search box must stay pinned at the top while the options scroll beneath it (`position: sticky; top: 0; z-index: 1;`).
- **Instant Client-Side Filtering:** Case-insensitive substring match against item labels.
- **Keyboard Continuity:** Pressing `ArrowDown` while typing in the search input highlights the first filtered result without losing search input text.
- **Empty State:** When no results match, render a dedicated status message:
  ```html
  <div class="dropdown-empty" role="status" aria-live="polite">
    No options found for "{query}"
  </div>
  ```
- **Clear Button:** Include an icon or `Escape` clear mechanism inside the search input.

---

## Rule 5: Hit 150ms (Snappy Animation Budget)

Animations slower than 200ms make utilities feel sluggish; transitions faster than 100ms feel jarring or broken. 150ms is the Goldilocks zone for micro-surfaces.

### 5.1 Animation Spec
- **Duration:** Exactly `150ms`.
- **Timing Function:** `cubic-bezier(0.16, 1, 0.3, 1)` (snappy ease-out) on entrance; `cubic-bezier(0.4, 0, 1, 1)` or `ease-in` on exit.
- **Properties:** Transform (`scale` + `translateY`) and `opacity`. Never animate layout properties like `height`, `width`, or `top`.

### 5.2 Origin-Aware Transform
- When opening downward:
  ```css
  .dropdown-menu[data-placement="bottom"] {
    transform-origin: top center;
    animation: dropdownEnterDown 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes dropdownEnterDown {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  ```
- When flipped upward:
  ```css
  .dropdown-menu[data-placement="top"] {
    transform-origin: bottom center;
    animation: dropdownEnterUp 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes dropdownEnterUp {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  ```

### 5.3 Reduced Motion Override
Always respect user accessibility preferences:
```css
@media (prefers-reduced-motion: reduce) {
  .dropdown-menu,
  .dropdown-caret {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## Reference Implementation: React + Tailwind

Below is the golden standard template implementation adhering to all 5 rules:

```tsx
import React, { useState, useRef, useEffect, useId } from 'react';

export interface Option {
  value: string;
  label: string;
}

interface PerfectDropdownProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function PerfectDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  label = "Select"
}: PerfectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [maxHeight, setMaxHeight] = useState<number>(320);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const selectedOption = options.find((o) => o.value === value);
  const hasSearch = options.length >= 10; // Rule 4: 10+ items add search

  const filteredOptions = hasSearch && search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Rule 2: Flip on edge & boundary calculation
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const idealHeight = 320;

    const shouldFlip = spaceBelow < idealHeight && spaceAbove > spaceBelow;
    setPlacement(shouldFlip ? 'top' : 'bottom');
    setMaxHeight(Math.min(idealHeight, (shouldFlip ? spaceAbove : spaceBelow) - margin));
  };

  const handleOpen = () => {
    updatePosition();
    setIsOpen(true);
    setSearch('');
    const initialIndex = options.findIndex((o) => o.value === value);
    setHighlightedIndex(initialIndex >= 0 ? initialIndex : 0);
  };

  const handleClose = (restoreFocus = true) => {
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    if (isOpen && hasSearch) {
      // Focus search input on open
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen, hasSearch]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        handleClose(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  // Rule 3: Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        break;
      case 'Enter':
      case ' ':
        if (e.target === searchInputRef.current && e.key === ' ') return; // allow typing spaces in search
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          handleClose(true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose(true);
        break;
      case 'Tab':
        handleClose(false);
        break;
    }
  };

  return (
    <div className="relative inline-block w-full max-w-xs text-sm" onKeyDown={handleKeyDown}>
      {/* Rule 1: Clickable, 48px touch target, visible trigger, clear caret */}
      <button
        ref={triggerRef}
        type="button"
        id={`trigger-${id}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`menu-${id}`}
        onClick={() => (isOpen ? handleClose(true) : handleOpen())}
        className={`
          flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white
          px-3.5 text-left text-slate-800 shadow-sm transition-all duration-150
          min-h-[44px] md:min-h-[40px] max-md:min-h-[48px]
          hover:border-slate-400 hover:bg-slate-50
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2
          active:scale-[0.99]
        `}
      >
        <span className={`truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-900 font-medium'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Container */}
      {isOpen && (
        <div
          ref={menuRef}
          id={`menu-${id}`}
          role="listbox"
          aria-labelledby={`trigger-${id}`}
          tabIndex={-1}
          style={{ maxHeight: `${maxHeight}px` }}
          className={`
            absolute z-50 left-0 right-0 w-full overflow-hidden rounded-xl border border-slate-200
            bg-white shadow-xl ring-1 ring-black/5 overscroll-contain
            ${placement === 'top' ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'}
            /* Rule 5: 150ms snappy animation */
            transition-all duration-150 ease-out
            animate-in fade-in-0 zoom-in-95
          `}
        >
          {/* Rule 4: Sticky Search for 10+ items */}
          {hasSearch && (
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Search..."
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                aria-label="Filter options"
              />
            </div>
          )}

          {/* Scrollable list */}
          <div className="overflow-y-auto p-1" style={{ maxHeight: `${maxHeight - (hasSearch ? 52 : 8)}px` }}>
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400" role="status">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    id={`opt-${id}-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      handleClose(true);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`
                      relative flex cursor-pointer select-none items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-75
                      ${isHighlighted ? 'bg-indigo-50 text-indigo-900 font-medium' : 'text-slate-700'}
                      ${isSelected ? 'text-indigo-600 font-semibold' : ''}
                    `}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <svg className="h-4 w-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Dropdown Verification Checklist

Run this checklist against any dropdown code or design before shipping:

- [ ] **1. Touch & Trigger:**
  - Has `min-height: 48px` on touch / mobile devices (`pointer: coarse`).
  - Has a visible caret icon that rotates smoothly on open/close.
  - Has clear `:hover` and `:focus-visible` styles with sufficient color contrast.
- [ ] **2. Flip on Edge:**
  - Placed near screen bottom: Flips upward automatically without clipping.
  - Constrained by `max-height` (max 320px or available viewport height).
  - Uses `overscroll-behavior: contain` to prevent body scroll chaining.
- [ ] **3. Keyboard Accessibility:**
  - Trigger responds to `Enter`, `Space`, `ArrowDown`, and `ArrowUp`.
  - Up/Down arrows cycle through options.
  - `Escape` dismisses the menu and restores focus back to the trigger.
  - Proper ARIA attributes present (`combobox`, `listbox`, `option`, `aria-expanded`).
- [ ] **4. 10+ Items Search:**
  - Displays a search/filter input when item count is $\ge 10$.
  - Focus moves into search automatically when opened.
  - Filtering operates in real-time with an empty state fallback.
- [ ] **5. 150ms Snappy Timing:**
  - Animation duration is bounded to 150ms.
  - Uses subtle scale (`0.97` to `1`) and opacity transition with `transform-origin` aligned to trigger.
  - Disabled when `prefers-reduced-motion` is active.
