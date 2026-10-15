# Hypertune — Design Style Guide

This project follows **Material Design 3 (M3)** conventions. Read this guide
before touching any UI. It is the single source of truth for visual style.

All design tokens live in `src/control.css` (CSS custom properties on the
`.control-shell` / `:root` theme blocks). **Never hardcode colors in
components** — use the theme tokens. Art/SVG/glyph fills may only use
`currentColor` or `color-mix()` against tokens; never hardcode hue values
except for the per-icon accent palette defined below.

## Core principles

- **Filled, colored glyphs**: navigation and inline icons are Material
  Symbol-style filled paths (`fill="currentColor"`) rendered at 20–24px.
  Thin stroke-only icons are out of style for navigation.
- **Floating rounded surfaces**: elevated panels are inset from the page,
  rounded (`border-radius: 16px`), with layered `box-shadow` depth — not flat,
  border-only rectangles.
- **Elevation over borders**: distinguish surfaces with elevation (gradients,
  shadows, `--surface-*` tokens) before reaching for borders. When a divider
  is needed it must be clearly visible (use `--line-strong`, never
  `--border-rule`/`--line` — those are too faint).
- **State layers**: hovers are subtle overlays (`--hover`, `--surface-hover`)
  — a change of background/color, never a sudden border or outline.
- **Theme-awareness**: every style must hold up in **all shipped themes** (dark
  and light, plus every accent theme). Check contrast between adjacent surfaces
  in both dark and light before committing.
- **Bold labels**: navigation labels use high weight (`font-weight: 600–700`)
  and high-contrast text tokens so they read as interactive targets.

## Layout

### Sidebar (`.ht-sidebar`)

The left rail is a floating rounded panel (inset from the shell edge, rounded,
full outline, gradient background, layered drop shadows for lift) holding, top
to bottom:

- **Brand header** (`.ht-brand`): the `HYPERTUNE` wordmark with a `BETA` tag.
- **Section nav** (`.ht-nav` / `.ht-nav-item`): when a device is open, one item
  per available workspace tab (Overview, Performance, Lighting, Buttons,
  Profiles, Advanced) plus a Mouse test item. Each item is a flex row of
  `[icon] [label]` with a filled Material-style glyph (~17px); the active item
  carries `.is-active`. With no device connected the nav shows a single Devices
  item.
- **Foot actions** (`.ht-sidebar-foot`, shown while a device is open): the
  selected-device chip, then Share profile, Report a problem, and Back.
- **Attribution** (`.ht-legal`, pinned to the foot): the "In partnership with
  OpenMouse" credit plus the Source · AGPL-3.0 links required by the license.
  `.ht-legal--anchor` pushes it to the bottom when there is no device foot above it.

Keep the rail device-centric: it navigates *within* the connected device's
sections, not between separate app pages.

### Device cards

- Connected-device cards and the add-device cards are **square (1:1)**, equal
  size, on a centered grid.
- Card background is `--surface-strong` so cards separate clearly from the
  page background in every theme.
- No border at rest — border + subtle shadow appear only on hover.
- Device artwork:
  - Rendered through `.device-tile-image` as `position: absolute; inset: 0;
    object-fit: contain;` (+ `transform: scale(1.1)`), never cropped.
  - The card clips with `overflow: hidden`.
- The mouse add card and keyboard add card are identical size and shape. The
  keyboard add card in the device list must not carry the flex `max-width`
  that the empty-state add grid uses (`max-width: none` override).
- State: per-card "Connecting…" text from local state, not global labels.
- Cog/gear buttons are borderless icons (no square outline), `overflow:
  visible` on the icon svg so strokes are never clipped.

## Commandments

1. Never crop a product rendering; always `object-fit: contain`.
2. Never reintroduce the old 9:16 card aspect ratio for the connected list.
3. Never use `overflow: hidden` to "fix" artwork — pin the image box with
   absolute positioning instead.
4. Never use `--line` / `--border-rule` for dividers you want visible.
5. Never introduce a new UI concept (page, card, dialog) without reading this
   file and matching the M3 conventions above.