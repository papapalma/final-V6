---
trigger: always_on
---

---
name: golden-rule-design
description: >
  Enforces the Golden Rule and Golden Ratio (1:1.618), 8pt harmonic spatial grid,
  Gestalt Law of Proximity, optical padding ratios, typographic scales,
  and layout proportions across all UI, component designs, and CSS.
---

# Golden Rule Design System (Spacing, Padding, Proximity & Layout)

Always apply harmonic proportions, the Golden Ratio ($\phi \approx 1.618$), and the Gestalt Law of Proximity whenever creating, modifying, or reviewing UI components, styles, or page layouts in this codebase.

---

## 1. Core Principle & Spatial Harmonic Grid

Digital screens use an **8-point / 4-point harmonic scale** mapped directly to Golden Ratio progression steps ($\times 1.5 - 1.618$ per step):

| Token / Class | Pixels | Mathematical Step | Primary Purpose |
| :--- | :--- | :--- | :--- |
| `0.5` / `1` | **2px / 4px** | Micro base unit | Micro-proximity: icon-to-text gap, badge inner vertical offset |
| `1.5` / `2` | **6px / 8px** | Base quantum ($\times 1.5 - 2$) | Tight proximity: tightly-coupled siblings, input icon padding, label-to-helper |
| `3` | **12px** | Intermediate harmonic | Sub-element spacing: button group gap, card metadata row gap |
| `4` | **16px** | Standard default ($\times 1.6$) | Base container padding: standard card inner padding, form field gap |
| `6` | **24px** | Golden step ($16 \times 1.5$) | Balanced container: desktop card padding, modal content padding, widget gap |
| `8` | **32px** | Harmonic step ($16 \times 2$) | Section separation: stack gap between card groups, grid row/column gap |
| `12` | **48px** | Major golden step ($32 \times 1.5$) | Macro break: distance between major page sections, drawer gutters |
| `16` / `20` | **64px / 80px** | Layout boundary | Top-level layout split margins, hero section top/bottom padding |

> **Rule**: NEVER use arbitrary, non-harmonic values (e.g. `p-[11px]`, `gap-[7px]`, `m-[19px]`). Always snap to the harmonic scale above.

---

## 2. Gestalt Law of Proximity (Visual Clustering)

Elements that belong together must be visibly closer than elements that belong to separate ideas. White space communicates relationship and hierarchy.

### A. The Hierarchy of Distances
Always maintain strict inequality:
$$\text{Distance(Inline Children)} < \text{Distance(Form Fields)} < \text{Padding(Container)} < \text{Gap(Containers)} < \text{Margin(Sections)}$$

Example:
- Icon to button text: `gap-1.5` (6px) or `gap-2` (8px)
- Label to Input field: `mb-1.5` (6px)
- Field to next Field: `space-y-4` (16px)
- Inside Card Padding: `p-6` (24px)
- Card to adjacent Card: `gap-6` (24px) or `space-y-8` (32px)
- Card Section to next Section: `mt-12` (48px)

### B. Heading Asymmetry Rule (Anti-Floating Headings)
A heading introduces the content **below** it; it does **NOT** belong to the section above it.
- **Top Margin $\ge 1.618 \times$ Bottom Margin**:
  - Small heading (`h3` / `h4`): `mt-6 mb-2` (24px top / 8px bottom $\rightarrow$ 3:1 ratio)
  - Medium heading (`h2`): `mt-8 mb-3` (32px top / 12px bottom $\rightarrow$ 2.67:1 ratio)
  - Large heading (`h1`): `mt-12 mb-4` (48px top / 16px bottom $\rightarrow$ 3:1 ratio)
- **STRICTLY FORBIDDEN**: Symmetrical top and bottom margins on headers (e.g., `my-4`, `my-6`). This causes "floating heading syndrome" where the eye cannot determine which section the title introduces.

---

## 3. The Golden Padding Ratio (Optical Horizontal vs. Vertical)

Because human eyes read text horizontally, elements with equal vertical and horizontal padding (`py == px`) feel vertically choked and horizontally blunt.

### A. Buttons, Inputs, Badges & Chips
Always apply the **Golden Ratio for interactive padding**:
$$P_{\text{horizontal}} \approx 1.618 \times P_{\text{vertical}}$$

| Element Size | Tailwind Classes | Dimensions (V $\times$ H) | Optical Ratio |
| :--- | :--- | :--- | :--- |
| **Badge / Pill** | `py-0.5 px-2` | 2px $\times$ 8px | 4.0 (capsule) |
| **Compact / Chip** | `py-1 px-2.5` | 4px $\times$ 10px | 2.5 |
| **Standard Button / Input** | `py-2 px-3.5` or `py-2.5 px-4` | 8px $\times$ 14px / 10px $\times$ 16px | 1.6 – 1.75 |
| **Large / CTA Button** | `py-3 px-5` or `py-3.5 px-6` | 12px $\times$ 20px / 14px $\times$ 24px | 1.67 – 1.71 |

### B. Cards and Dialogs
- Mobile view: `p-4` (16px) or `p-5` (20px).
- Desktop view: `p-6` (24px) or asymmetric `py-6 px-8` (24px $\times$ 32px, ratio 1.33).
- Nested items inside cards must have smaller padding than the card boundary (e.g. inner list item `p-3` inside a `p-6` card).

---

## 4. The Golden Split Layout Rule ($61.8\% / 38.2\%$)

When designing multi-pane layouts, master-detail views, or split dashboards, apply the Golden Ratio proportion:
- **Primary / Active Workspace** (Chat Thread, Data Grid, Main Feed): **$\approx 61.8\%$** (`w-[62%]` or `flex-[1.618]`)
- **Secondary / Supporting Panel** (Conversation List, Filter Drawer, Meta Sidebar): **$\approx 38.2\%$** (`w-[38%]` or `flex-1`)

For modals and cards:
- Sizing aspect ratios should aim near 1.618 : 1 (width to height) for comfortable viewing without excessive vertical scrolling.

---

## 5. Typographic Scale & Line-Height Harmonic Balance

- **Modular Scale**:
  - Metadata / Timestamp: `text-xs` (12px, leading 16px)
  - Body UI / Input text: `text-sm` (14px, leading 20px) or `text-base` (16px, leading 24px)
  - Subheading / Card Title: `text-lg` (18px) or `text-xl` (20px)
  - Section Title: `text-2xl` (24px)
  - Page Title: `text-3xl` (30px) or `text-4xl` (36px)
- **Line-Height Proportionality**:
  - Small text requires generous leading for legibility: `leading-relaxed` or `leading-normal` (1.5 – 1.618 line height ratio).
  - Large headings require tight leading to prevent fragmented letter blocks: `leading-tight` or `leading-snug` (1.15 – 1.25 line height ratio).

---

## 6. The 60-30-10 Visual Weight Rule

Ensure color, surface, and contrast follow visual distribution harmony:
- **60% Dominant Canvas / Surface**: Light backgrounds (`bg-background`, `bg-slate-50`), subtle card layers (`bg-card`), ample negative space.
- **30% Structural Secondary**: Borders (`border-border`), secondary typography (`text-muted-foreground`), sidebars, table headers, inactive tabs.
- **10% Intentional Accent**: Primary actions (`bg-primary`), notification pips, focused rings, active indicators. Never scatter high-saturation colors indiscriminately.

---

## 7. Pre-Flight Design Checklist

Before completing any frontend or UI change, verify:
- [ ] **Proximity Check**: Is the heading closer to its body than to the preceding section (`mt >= 1.6 * mb`)?
- [ ] **Containment Check**: Is inner child spacing strictly smaller than outer container padding?
- [ ] **Button / Chip Padding**: Does horizontal padding exceed vertical padding by roughly 1.6x (`py-2 px-3.5` or `py-2.5 px-4`)?
- [ ] **Grid Harmony**: Are all `margin`, `padding`, and `gap` values aligned with the 4px/8px harmonic scale?
- [ ] **Split Proportions**: Do dual-column split views honor the ~62% / 38% golden balance?
