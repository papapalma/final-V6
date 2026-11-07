---
description: Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or reviewing gesture-driven UI,spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, translucent materials
---

# Apple Design

## Initial Response

When first invoked without a specific question, respond only with:

> I'm ready to help you build fluid, Apple-style interfaces on the web. My knowledge comes from Apple's WWDC design talks, translated for the web.

Share nothing else until the user asks a question.

This skill distills Apple's WWDC talks, chiefly *Designing Fluid Interfaces* (2018), for CSS, Pointer Events, `requestAnimationFrame`, and spring libraries like Motion/Framer Motion.

**Core idea:** an interface feels alive when motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant. Springs make this natural because they are interruptible and velocity-aware. Fluid interfaces behave like the physical world: instant response, continuous motion, momentum, soft boundaries, redirection mid-motion.

## 1. Response: kill latency

Once lag appears, the feeling of directness collapses.

- **Respond on pointer-down, not release.** Highlight buttons the instant they're pressed.
- **Audit every latency** on the input path: debounces, artificial timers, transition waits, tap delays.
- **Give continuous feedback during the interaction.** For drags, sliders, and drawers, update 1:1 with the pointer throughout, not only at the end.

```css
.button:active {
  transform: scale(0.97);
  transition: transform 100ms ease-out;
}
```

## 2. Direct manipulation: 1:1 tracking

Content must stay glued to the pointer and respect where the user grabbed it; snapping to the element's center breaks the illusion.

- Use Pointer Events with `setPointerCapture` so tracking continues outside the element.
- Keep a short history of positions and timestamps so you can compute velocity at release.

```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  const grabOffset = e.clientY - el.getBoundingClientRect().top;
  // track position + timestamp history for velocity
});
```

## 3. Interruptibility: the most important principle

Every animation must be redirectable at any moment. A modal that is grabbed mid-close should follow the finger, not finish closing and then reopen.

- **Never lock input during a transition.**
- **Animate from the live on-screen value, never the target,** or you'll see a jump.
- **Avoid CSS transitions and `@keyframes` for gesture-driven motion.** They can't be grabbed and reversed smoothly. Springs start from the current value.
- **Blend velocity on reversal.** Hard-cutting between animations creates a "brick wall." Use spring libraries that re-target while carrying velocity.
- **Split 2D motion into independent X and Y springs.**

## 4. Behavior over animation: use springs

Fixed-duration animations can't respond to new input; a spring just takes a new target and stays continuous. Use springs for anything the user can touch.

- **Damping ratio:** controls overshoot. `1.0` is critically damped (no bounce); below `1.0` it overshoots.
- **Response:** seconds to reach the target. Lower is snappier. It is not duration.

**Defaults:** start at damping `1.0`. Add bounce (about `0.8`) only when the gesture carried momentum (a flick or throw). Overshoot on a menu that just appeared feels wrong; on a flicked card it feels right.

| Interaction | Damping | Response |
| --- | --- | --- |
| Move/reposition (e.g. PiP) | 1.0 | 0.4 |
| Rotation | 0.8 | 0.4 |
| Drawer/sheet | 0.8 | 0.3 |

In Motion/Framer Motion, `bounce` + `duration` maps closely to damping + response.

```js
import { animate } from 'motion';

animate(el, { y: 0 }, { type: 'spring', bounce: 0, duration: 0.4 });      // default
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4 }); // after a flick
```

## 5. Velocity handoff

When a gesture ends, continue at the pointer's exact release velocity so there's no seam between dragging and animating. Some APIs expect relative velocity:

```
relativeVelocity = gestureVelocity / (target − current)
```

Example: at `y=50`, target `y=150`, finger at 50px/s gives `50 / 100 = 0.5`. Motion and Framer Motion accept absolute px/s via `velocity`.

## 6. Momentum projection

Don't snap to the nearest boundary from the release point. Project where the gesture is going, then snap to the target nearest that projection. Apple uses exponential decay:

```js
// rate: 0.998 for normal scroll feel, 0.99 for snappier
function project(velocity /* px/s */, rate = 0.998) {
  return (velocity / 1000) * rate / (1 - rate);
}

const target = nearestSnapPoint(position + project(releaseVelocity));
animateSpringTo(target, { velocity: releaseVelocity });
```

Don't use the textbook `v²/(2·decel)`. Decide reverse versus commit by velocity sign, not position, at release.

## 7. Spatial consistency

- **Enter and exit along the same path.** A panel sliding in from the right dismisses to the right.
- **Anchor to the source.** Set `transform-origin` to the trigger for menus, popovers, and sheets.
- **Mirror easing on reversible transitions** with inverse cubic-bézier control points.

## 8. Hint in the direction of the gesture

Intermediate frames should point toward the outcome (Control Center modules grow up and out toward your finger) rather than interpolating blindly.

## 9. Rubber-banding

At an edge, resist progressively instead of stopping hard.

```js
function rubberband(overshoot, dimension, c = 0.55) {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}
```

## 10. Gesture details

- **Tap:** highlight on down, commit on up. Add about 10px of hit padding; allow cancel by dragging away and back.
- **Drag/swipe:** require about 10px of movement before committing to a direction, then track 1:1.
- **Recognize gestures in parallel** and cancel losers once intent is clear. Avoid final-state-only events like `swipeleft`.
- **Minimize disambiguation delays.** Pay the double-tap delay only where double-tap exists.

## 11. Frame-level smoothness

- Use `requestAnimationFrame` as the display-synced clock. Animate only `transform` and `opacity`; use `will-change` where motion is imminent.
- Keep per-frame change under the perception threshold to avoid strobing. For very fast motion, a subtle blur or stretch conveys speed.

## 12. Materials and depth

Translucent materials add structure without stealing focus. Approximate them with `backdrop-filter`.

- **Make nav bars, toolbars, and sheets translucent,** with content scrolling beneath.
- **Material weight encodes hierarchy.** Heavier materials separate structural regions; lighter ones highlight controls. Never stack a light translucent surface on another.
- **Bigger surfaces read as thicker:** stronger blur and deeper shadow.
- **Dim to focus, separate to keep flow.** Modal tasks get a scrim; parallel panels use translucency and offset without one.
- **Keep text legible:** avoid flat gray; use higher contrast and slightly heavier weight. Put color on a solid layer.
- **Use scroll edge effects instead of hard dividers:** a small blur or gradient fade where content meets floating chrome.
- **Materialize, don't just fade:** animate blur radius and scale together.

```css
.toolbar {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.4);
}
```

## 13. Multimodal feedback

1. **Causality:** trigger feedback on the real causal event and match its character to the action.
2. **Harmony:** visual, audio, and haptic must land on the same frame.
3. **Utility:** reserve feedback for meaningful moments (success, error, commit, snap). Over-feedback teaches users to ignore it.

## 14. Reduced motion and accessibility

Reduced motion means a gentler equivalent, not no feedback.

- **`prefers-reduced-motion: reduce`:** swap slides, springs, and parallax for short cross-fades. Drop overshoot.
- **`prefers-reduced-transparency: reduce`:** raise opacity, drop the blur.
- **`prefers-contrast: more`:** near-solid backgrounds with a contrasting border.

Also avoid full-viewport moving backgrounds, slow loops near 0.2 Hz, and abrupt brightness jumps.

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: white; backdrop-filter: none; }
}
```

## 15. Typography

- **Tracking is size-specific.** Tighten large text, keep body near `0`.
- **Leading varies inversely with size:** tight on headings, looser on body.
- **Build hierarchy from weight, size, and leading together.**
- **Respect text-size settings:** use `rem`/`em` so layout scales.
- **Default to the system font;** it ships optical sizing and tuned tracking.

```css
:root { font: 100%/1.5 system-ui, sans-serif; }

.display {
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-optical-sizing: auto;
}
```

## 16. Design foundations

From *Principles of Great Design* (WWDC 2026):

1. **Purpose:** decide what *not* to build. Every feature costs time, attention, and trust.
2. **Agency:** keep people in control. Offer easy undo; reserve confirmations for destructive, irreversible actions.
3. **Responsibility:** act in the user's interest. Ask for permissions only when needed; anticipate misuse, especially with AI.
4. **Familiarity:** build on what people know and be consistent. Break a pattern only if you can show it's better.
5. **Flexibility:** design for varied contexts, devices, and abilities; allow personalization.
6. **Simplicity, not minimalism:** strip the unnecessary, use hierarchy, show the common path first and advanced options one level deeper.
7. **Craft:** every spacing, timing, and alignment value should be deliberate. Jitter and misalignment read as carelessness.
8. **Delight:** the result of getting the other seven right, not confetti on top.

**Tactical rules:**

- **Feedback comes in four kinds:** status, completion, warning, error. Validate inline, not on submit.
- **Wayfinding:** every screen answers where am I, where can I go, what's here, how do I get out.
- **Grouping and mapping:** place controls near what they affect. If a control needs a label to explain it, the mapping is weak.
- **Prefer specific labels** ("Progress", "Library") over vague ones ("Home").

## 17. Process

- **Prototype interactively.** A working demo is worth a million static designs.
- **Design interaction and visuals together;** motion is not a layer added afterward.
- **Test with real people,** and review motion in slow motion to catch what's invisible at full speed.

## Quick Reference

| Need | Value |
| --- | --- |
| Default spring | damping 1.0, response 0.3–0.4 |
| Flick spring | damping ~0.8, response 0.3–0.4 |
| Flick landing | `current + (v/1000)·d/(1−d)`, d ≈ 0.998 |
| Interrupt | start from live on-screen value |
| Reverse vs. commit | velocity sign, not position |
| Drag | Pointer Events + capture, respect grab offset |
| Boundary | rubber-band, never hard-stop |
| Tracking | `-0.02em` large, ~0 body |
| Reduced motion | cross-fade, no slide/spring |
