---
name: Synthetic Data Studio
description: Restrained landing and compact workspace for structured synthetic data.
colors:
  primary: "#191919"
  primary-hover: "#333333"
  accent: "#2858cb"
  accent-soft: "#eef3ff"
  background: "#fafafa"
  surface: "#ffffff"
  surface-muted: "#f5f5f5"
  sidebar: "#f8f8f7"
  border-subtle: "#e8e8e8"
  border-medium: "#d1d1d1"
  text-muted: "#656565"
  success: "#166534"
  error: "#991b1b"
  warning: "#854d0e"
typography:
  display:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(36px, 4.5vw, 62px)"
    fontWeight: 700
    lineHeight: 1.13
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(24px, 3vw, 30px)"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11px"
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "18px"
spacing:
  compact: "8px"
  control: "12px"
  panel: "16px"
  section: "24px"
  workspace: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xs}"
    padding: "6px 10px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  badge-neutral:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.xs}"
    padding: "2px 7px"
  navigation-item:
    textColor: "{colors.primary-hover}"
    padding: "8px 10px"
    height: "36px"
---

# Design System: Synthetic Data Studio

## Overview

**Creative North Star: "Restrained structured-data workspace"**

The owner requested a CoreShift-inspired light landing, a compact Oneleet-style
sidebar/table workspace, and scroll and transitional motion. White surfaces,
dark text, quiet rules and selective cobalt interaction cues implement that
direction. The landing has generous breathing room; the working view prioritizes
scanable records and adjacent controls. Avoid generic AI design patterns as
requested by the owner.

This document captures implemented CSS and components, not a new visual proposal.
Sources are `frontend/styles/globals.css`, `frontend/styles/landing.css`,
`frontend/components/layout/Workspace.module.css`, `Header.tsx`, `Sidebar.tsx`,
`EntryScreen.tsx` and `pages/_app.tsx`. Product constraints are in `PRODUCT.md`.
The owner supplied [CoreShift](https://dribbble.com/shots/25869450-Sleek-Landing-Page-for-CoreShift)
and a Oneleet workspace image. The decorative hero was generated with built-in
imagegen; its exact prompt and provenance are in
`frontend/public/media/data-hero.prompt.md`. Higgsfield generation was blocked by
the account plan; no Higgsfield media job was submitted.

**Key Characteristics:**

- Light neutral surfaces with compact, legible working controls.
- Cobalt marks focus, selected tables and related-record links.
- A spacious landing becomes a dense table workspace.
- Native motion reveals structure while content remains available without it.
- Displayed records, counts, status and reference quality come from actual state.

## Colors

The palette is mostly neutral; color identifies actionable links and meaningful
state rather than filling every surface.

### Primary

- **Near-black:** primary actions, titles and the identity mark.
- **Charcoal:** body text and primary-action hover.
- **Cobalt:** keyboard focus, linked IDs, active navigation and selected tables.
- **Pale cobalt:** selected table controls and upload focus/drag feedback.

### Neutral

- **White:** panels, the landing and the main workspace.
- **Near-white:** application background and sticky table headers.
- **Soft gray:** muted surfaces and secondary-action hover.
- **Warm pale gray:** compact workspace sidebar.
- **Light gray rules:** subtle borders; stronger gray separates input surfaces.
- **Mid-gray:** captions, field types, secondary text and navigation labels.

Status colors use forest green, muted crimson and muted amber with low-opacity
matching backgrounds and borders. Informational badges stay neutral.

**The Actual State Rule.** Apply status color only to a real reported state;
unavailable quality is not a positive score.

## Typography

**Display Font:** Manrope with system sans-serif fallbacks.
**Body Font:** Manrope with system sans-serif fallbacks.
**Label/Mono Font:** JetBrains Mono for code and existing technical-value styles.

Fonts are loaded by `next/font/google` with swap behavior. The active workspace
table uses Manrope and tabular numerals; do not force its records into the legacy
monospaced global table styling.

### Hierarchy

- **Display:** balanced landing headline with tight tracking. At the landing
  mobile boundary it uses `clamp(30px, 6.7vw, 45px)` and line-height `1.18`.
- **Headline:** section titles; the workflow title has its own larger responsive
  size (`clamp(28px, 3.5vw, 42px)`).
- **Title:** workspace heading, reduced to `20px` at the mobile boundary.
- **Body:** compact application prose. Landing introductions use larger text
  and longer line-height; relationship explanations cap at `70ch`.
- **Label:** table metadata, dataset controls and captions. Sidebar group labels
  are `10px`; table field headings are `11px` with `12px` record cells.

## Layout

The viewport shell uses `100dvh` with internal scrolling. Landing content has a
maximum width of `1200px`, navigation `860px`, and creation area `800px`. The
workflow uses two columns and a connecting rule; examples are divided rows.

The desktop workspace has a `216px` sidebar and `244px` adjacent insights region.
Data receives flexible remaining width with `min-width: 0`; its padding is
`22px 32px`. Tables scroll within a bordered region with sticky headers and a
height clamped between `280px` and `580px`. Headers carry field/type labels;
plain-language relationships sit above records, and complete CSV/JSON downloads
stay beside table selection.

At `901–1150px`, sidebar and insights narrow to `192px` and `210px`. At `900px`
and below, insights stack above data and metric rows reflow. At `768px` and
below, landing navigation retains the creation action, workflow becomes one
column, and landing spacing contracts. At `640px` and below, the workspace
sidebar becomes an off-canvas dialog (`min(280px, 85vw)`), metrics use two columns,
and editor controls and quality comparisons stack. Mobile tables retain internal
horizontal scrolling and have a `420px` maximum height. These are code boundaries;
browser verification is recorded separately in the active repair plan.

Motion uses the shared decelerating curve `cubic-bezier(.16, 1, .3, 1)`. Hero and
section arrivals use short translations, clipping and a growing workflow rule
(`550–850ms`). Workspace arrival is `400ms`, table appearance `200ms`, and sidebar
movement `250ms`. IntersectionObserver reveals sections once at a `0.12`
threshold. Supporting browsers add view-timeline hero recession. Motion is
enabled under `prefers-reduced-motion: no-preference`; reduced motion also disables
smooth landing scrolling. Content is not hidden while waiting for an observer.

## Elevation & Depth

Borders and tonal differences separate working regions. Shadows have small,
specific roles: the floating landing navigation, selected sidebar item, slider
thumb and modal. The working table itself has no decorative shadow.

### Shadow Vocabulary

- **Landing navigation:** `0 3px 20px #1919190c` gives the header light separation.
- **Selected navigation:** `0 1px 2px #19191905` supports the active white row.
- **Modal:** `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)` separates the editor from its blurred scrim.

## Shapes

Controls use small rounded corners, table frames use the smallest radius, and
editors use wider corners. Landing calls to action and identity marks use `7px`
corners; the floating header uses `12px`. The creation panel uses the large radius.
Rules remain thin (`1px`); the upload target uses a dashed border. Circular workflow
numbers are tied to the process illustration.

## Components

### Buttons

Compact and direct. Primary actions use a near-black fill with white text;
secondary actions use a white surface and subtle border; ghost actions use muted
text. Hover changes fill or text. Disabled controls reduce opacity and suppress
actions. Landing primary buttons have `12px 18px` padding, `7px` corners and a
`42px` minimum height.

### Chips

Small status badges use the smallest corners, uppercase labels and state-specific
text/background/border assignments. Neutral counts and information remain gray.
Selected table buttons use pale cobalt with cobalt text and a visible border.

### Cards / Containers

White, thin-bordered panels use the medium radius and panel padding. Smaller
existing cards use the small radius. Insights are an adjacent region separated by
a rule; examples use full-width rows rather than independent boxed cards.

### Inputs / Fields

Existing small fields use white fill, subtle borders and the smallest radius.
The landing prompt is a borderless textarea inside the creation panel, with an
inset cobalt focus ring. Upload focus/drag states use pale cobalt and a cobalt
border. Errors are exposed as alerts; submitted input becomes busy and disabled.

### Navigation

Landing anchors lead to working page sections. Workspace rows have small icons,
compact labels, hover fill and a white active row with cobalt text. Documents and
reference-quality controls appear only when supported by the current source.
On mobile, navigation contains keyboard focus, closes with Escape and restores
focus to its trigger. Prompt/upload tabs support arrow-key switching.

### Data inspection

Sticky field headers, subtle alternating rows, tabular numerals and underlined
cobalt links support scanning. Related-record links perform actual lookups.
Pagination and full-table downloads preserve the generated snapshot. Keep quality
details tied to a reference and retain unavailable, pending and failed states.

Keyboard focus uses visible cobalt outlines: `2px` with `4px` offset on landing
controls, `3px` in the workspace and `2px` in the sidebar. The prompt uses an inset
ring, upload uses focus-within, and a skip link reaches main content. Editor focus
containment and return focus live in `useDialogFocus.ts`.

## Do's and Don'ts

### Do:

- **Do** preserve compact working controls, sticky field headers and full-table downloads.
- **Do** use cobalt for keyboard focus, selected controls and real related-record links.
- **Do** keep records, counts and measured quality tied to the active source and snapshot.
- **Do** keep content available with reduced motion or unsupported animation timelines.
- **Do** retain decorative-image provenance separately from generated dataset output.

### Don't:

- **Don't** add fabricated customers, testimonials, usage statistics or quality scores.
- **Don't** replace the owner's restrained references with generic AI visual patterns.
- **Don't** add navigation to unimplemented history, account, pricing or integration features.
- **Don't** claim Higgsfield generated the existing hero or submitted an asset job.
- **Don't** present CSS breakpoints as completed browser verification.
