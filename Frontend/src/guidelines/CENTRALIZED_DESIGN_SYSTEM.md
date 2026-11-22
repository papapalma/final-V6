# Centralized Design System

## Purpose
This guide defines the shared visual and interaction rules for the BMDC interface so all features feel consistent, user friendly, and engaging.

## Core Visual Language
- Theme direction: Cohesive Slate & Brand Blue (60-30-10 visual balance) with calm neutral surfaces and semantic status accents.
- Typography:
  - Display/headings: Sora
  - Body/UI text: Manrope
- Color tokens:
  - Primary: Brand blue (`#2563eb` light / `#3b82f6` dark)
  - Surfaces: Clean slate neutrals (`#f8fafc` canvas, `#ffffff` cards / `#020617` & `#0f172a` dark)
  - Semantic status colors (green, amber, red) restricted to status pills, badges, and alerts
- Surface strategy:
  - Clean 1px slate borders and soft layered elevation
  - Hover lift strictly opt-in via `Card interactive` / `.ds-card-interactive` (static table/form cards remain anchored)

## Token Source of Truth
Use CSS custom properties in `src/index.css` (compiled via Tailwind CSS v4) as the single token source (`src/styles/print.css` handles print media):
- Golden ratio tokens (`--ratio-phi`, `--ratio-golden-split-main`, `--aspect-golden`)
- Color tokens (`--background`, `--primary`, etc.)
- Surface tokens (`--surface-soft`, `--surface-raised`)
- Motion tokens (`--duration-fast`, `--duration-normal`, `--ease-standard`)
- Typography tokens (`--font-display`, `--font-body`)

## The Golden Rule: Spacing, Padding, and Proximity
To ensure every screen feels balanced, deliberate, and effortless to scan, all interfaces must follow these mathematical and perceptual design rules:

### 1. Harmonic Spatial Scale (8-Point Grid aligned to Golden Progression)
Always choose layout and component spacing from the harmonic scale:
- **Micro (2px / 4px - `gap-0.5`, `gap-1`)**: Icon-to-text spacing, badge internal offsets.
- **Tight (6px / 8px - `gap-1.5`, `gap-2`)**: Related metadata, label-to-input gap, compact list elements.
- **Sub-element (12px - `gap-3`)**: Button group spacing, metadata rows.
- **Standard Base (16px - `gap-4`, `p-4`)**: Form field separation, mobile container padding.
- **Golden Container (24px - `gap-6`, `p-6`)**: Standard desktop card padding, widget separation ($16 \times 1.5$).
- **Section Stack (32px - `gap-8`, `p-8`)**: Distance between major cards/components.
- **Macro Break (48px - `gap-12`, `p-12`)**: Separation between page sections and drawer gutters ($32 \times 1.5$).
- **Layout Division (64px+ - `gap-16`, `p-16`)**: Major canvas-level margins.

### 2. Gestalt Law of Proximity (Visual Clustering)
- **Asymmetric Heading Rhythm**: A heading MUST belong visibly to the content beneath it.
  - Heading top margin must be at least $1.618\times$ the bottom margin:
    - Small headings (`h3`/`h4`): `mt-6 mb-2`
    - Section headings (`h2`): `mt-8 mb-3`
    - Page titles (`h1`): `mt-12 mb-4`
  - Symmetrical margins (e.g. `my-4`) on headings are forbidden.
- **Strict Spatial Hierarchy**:
  $$\text{Distance(Inline Children)} < \text{Distance(Fields)} < \text{Padding(Container)} < \text{Gap(Containers)}$$

### 3. Golden Ratio Padding for Interactive Elements
Text strings scan horizontally. Interactive components with square padding feel choked:
- Maintain **$P_{\text{horizontal}} \approx 1.618 \times P_{\text{vertical}}$**:
  - Small / Badge: `py-1 px-2.5`
  - Standard Button / Input: `py-2 px-3.5` or `py-2.5 px-4`
  - Large / CTA Button: `py-3 px-5` or `py-3.5 px-6`

### 4. Golden Split Layouts ($61.8\% / 38.2\%$)
- In split views (e.g. messenger chat thread vs conversation list, master-detail views, analytics sidebars):
  - Primary focus area: $\approx 61.8\%$ (or `flex-[1.618]` / `w-[62%]`)
  - Secondary context panel: $\approx 38.2\%$ (or `flex-1` / `w-[38%]`)

## Shared Interaction Classes
These classes are centralized and should be reused instead of ad hoc effects:
- `ds-shell`: page-shell background treatment
- `ds-sidebar`: sidebar surface styling
- `ds-topbar`: sticky top-bar glass effect
- `ds-page`: page-entry animation
- `ds-nav-item`: navigation hover/active behavior
- `ds-button`: button micro-interactions
- `ds-card`: card hover depth and polish
- `ds-field`: form field focus and transition treatment

## Component Usage Rules
- Use shared primitives from `src/components/ui` first.
- Avoid one-off inline animation values unless absolutely necessary.
- Prefer token-based color and spacing over hardcoded values.
- For new high-traffic screens, wrap shell areas with shared classes before adding custom styles.

## Micro-Interaction Principles
- Keep motion fast and purposeful.
- Prioritize feedback over decoration:
  - Hover state for discoverability
  - Focus state for keyboard clarity
  - Press state for click confirmation
- Do not animate large layout shifts.
- Respect readability and contrast in both light and dark modes.

## Accessibility Guardrails
- Maintain visible focus ring behavior.
- Preserve semantic color intent (info, success, warning, destructive).
- Ensure text remains readable on gradient surfaces.
- Avoid reducing motion clarity for critical status/alerts.

## Implementation Notes
When adding a new UI module:
1. Start with shared primitives (`Button`, `Card`, `Input`, `Select`).
2. Apply centralized `ds-*` classes as needed.
3. Validate both desktop and mobile behavior.
4. Keep visual language aligned with this guide.
