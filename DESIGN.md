---
name: CreatorPulse Studio
description: Manajemen konten dan analitik kreator TikTok: login, posting video, dan analitik performa.
colors:
  slate-deep: "hsl(222.2 47.4% 11.2%)"
  slate-ink: "hsl(222.2 84% 4.9%)"
  slate-paper: "hsl(0 0% 100%)"
  slate-mist: "hsl(210 40% 96.1%)"
  slate-border: "hsl(214.3 31.8% 91.4%)"
  slate-ring: "hsl(222.2 84% 4.9%)"
  signal-red: "hsl(0 84.2% 60.2%)"
  tiktok-red: "#fe2c55"
  tiktok-cyan: "#25f4ee"
  tiktok-dark: "#000000"
typography:
  display:
    fontFamily: "system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "calc(var(--radius) - 4px)"
  md: "calc(var(--radius) - 2px)"
  lg: "var(--radius)"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-default:
    backgroundColor: "{colors.slate-deep}"
    textColor: "{colors.slate-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-destructive:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.slate-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.slate-paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input-default:
    backgroundColor: "{colors.slate-paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"

# Design System: CreatorPulse Studio

## Overview

**Creative North Star: "The Content Control Room"**

A dashboard-grade control room for digital agencies managing many TikTok creators and accounts from one place. The system is precise and confident, built on clean utility: plenty of white space, weight and size carrying hierarchy, and color held in reserve so that when it does appear it means something. Surfaces are white or near-white slate, text is deep slate ink, and interactive states lift subtly. TikTok's brand red and cyan appear only at brand touchpoints — never as decoration.

**Key Characteristics:**
- Industrial and efficient components: clear states, distinct borders, visible focus rings, built for speed.
- Slate & Signal palette: deep slate depth, paper-white surfaces, mist backgrounds, signal red for destructive actions.
- Flat-by-default depth: subtle shadows on cards, selects, and popovers only; no zero-blur block shadows.
- The One Brand-Touchpoint Rule. TikTok red (#fe2c55) and cyan (#25f4ee) are reserved for TikTok brand moments (connect, auth, publishing status). They are never used as decorative accents on agency UI.

## Colors

A restrained slate-and-paper neutral system with one signal red and TikTok brand accents held in reserve.

### Primary
- **Slate Deep** (`hsl(222.2 47.4% 11.2%)`): primary button backgrounds, active/selected tab states, focus rings, and the deepest ink on the page. Used sparingly — its rarity is the point.

### Secondary
- **Slate Mist** (`hsl(210 40% 96.1%)`): secondary button backgrounds, muted surface panels, tab list backgrounds, and select-item highlight states. The quiet layer behind primary content.

### Neutral
- **Slate Ink** (`hsl(222.2 84% 4.9%)`): body and heading text, card and popover text, outline button text, input text. Near-black slate, never pure black.
- **Slate Paper** (`hsl(0 0% 100%)`): page background, card and popover backgrounds, input backgrounds.
- **Slate Border** (`hsl(214.3 31.8% 91.4%)`): input borders, card borders, dividers, the one-pixel separator in select lists.
- **Slate Ring** (`hsl(222.2 84% 4.9%)`): focus-visible rings on buttons, inputs, selects, checkboxes, and tabs.
- **Signal Red** (`hsl(0 84.2% 60.2%)`): destructive button backgrounds and error states. Reserved for actions that cannot be undone.

### Brand (TikTok)
- **TikTok Red** (`#fe2c55`) and **TikTok Cyan** (`#25f4ee`): brand accents defined in the Tailwind theme, reserved for TikTok touchpoints (connect button, auth flow, publishing status). **TikTok Dark** (`#000000`) is the brand's dark anchor. These are theme tokens available for use; they are not yet applied to shared components.

Dark mode is handled by the `.dark` class, which inverts surface and foreground roles (background becomes deep slate, foreground becomes paper). Tokens above are the canonical light-mode values.

## Typography

**Display Font:** system-ui (with sans-serif fallback)
**Body Font:** system-ui (with sans-serif fallback)
**Label Font:** system-ui (with sans-serif fallback)

**Character:** A single rational system face. Hierarchy is carried by weight and size alone — no second family, no decorative display face. Tracking-tight on headings keeps bold titles compact and confident.

### Hierarchy
- **Display** (800, clamp(1.875rem, 4vw, 3rem), leading 1, tracking -0.025em): hero headlines on the landing page only. Scales from text-3xl to text-5xl across breakpoints.
- **Headline** (700, 1.875rem, leading 1.25): section headings (h2).
- **Title** (600, 1.25rem, leading 1, tracking -0.025em): card titles and policy page headings.
- **Body** (400, 0.875rem, leading 1.5): paragraph text, descriptions, helper copy. Max line length ~65–75ch where prose runs long.
- **Label** (500, 0.875rem, leading 1): field labels and button text.

**The One Voice Rule.** One typeface, one scale. Display weight steps are obvious (800 → 700 → 600 → 500 → 400); do not introduce intermediate weights or a second family for emphasis.

## Layout

Container-centered pages with `2rem` horizontal padding, expanding to a max width of `1400px` at the `2xl` breakpoint. The app shell is a top navigation bar with the content area below; dashboard and settings pages use cards and tabs inside the container. Spacing rhythm steps: 4px (tight groups, e.g. tab-list padding), 8px (sm), 16px (md), 24px (lg, card padding), and 40px touch-target heights for primary buttons. More space sits above a heading than below it (headings carry `mb-6` to `mb-12`; body text keeps default leading). Responsive behavior is breakpoint-driven (sm/md/lg) with type and margins scaling up on larger screens.

## Elevation & Depth

Flat-by-default. Depth is conveyed through tonal layering (paper on mist, mist on paper) and one-pixel borders, not through shadow. Shadows appear only as a response to state or container role: cards carry a subtle base shadow, select popovers and tabs' selected state carry `shadow-sm`, and focused rings lift interactive controls. No zero-offset colored halos and no block shadows.

### Shadow Vocabulary
- **Card base** (`shadow`): container depth for cards and dashboard panels at rest.
- **Popover / selected** (`shadow-sm`): select dropdowns and the active tab state — light lift, never heavy.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus) or container role (card, popover). Never as decoration.

## Shapes

A single radius token (`--radius`, 0.75rem / 12px) drives every corner, stepped down for smaller elements: `sm` (radius − 4px), `md` (radius − 2px), `lg` (full radius). Buttons, inputs, selects, checkboxes, and tabs use `md` rounding; cards use `lg` rounding (12px). Borders are one pixel in slate-border on inputs, cards, and select lists; no inset borders, no one-sided borders, and no geometric masks standing in for organic contours.

## Components

### Buttons
- **Shape:** md rounding (radius − 2px), height 40px for default, 36px (sm), 44px (lg), 40×40px (icon).
- **Primary:** slate-deep background, slate-ink paper text, label type (500, 0.875rem), padding 8px 16px. Hover deepens opacity (primary/90).
- **Destructive:** signal-red background, slate-paper text; used for actions that cannot be undone.
- **Outline / Secondary / Ghost:** outline uses slate-paper background with slate-ink text and a slate-border border; secondary uses slate-mist background; ghost is transparent until hover. All share label type and md rounding.
- **Hover / Focus:** hover states shift background opacity or tint (muted/accent); focus-visible shows a 2px slate-ring ring with a 2px offset, outline-none.

### Inputs / Fields
- **Style:** stroke border in slate-border, slate-paper background, slate-ink text, body type (400, 0.875rem), md rounding, height 40px, padding 8px 12px. Placeholder text in muted-foreground.
- **Focus:** outline-none, 2px slate-ring ring with 2px offset.
- **Error / Disabled:** destructive signaling via signal-red text/border where applied; disabled controls show pointer-events-none and 50% opacity.

### Cards / Containers
- **Corner Style:** lg rounding (full 0.75rem radius).
- **Background:** slate-paper with slate-ink text.
- **Shadow Strategy:** base `shadow` at rest (see Elevation).
- **Border:** one-pixel slate-border.
- **Internal Padding:** 24px (lg) for header/content/footer; header uses `space-y-1.5` internally.

### Navigation
- **Style:** top bar, container-centered. Tabs use a mist background list with 1px padding, md-rounded triggers (px-3 py-1, label type), selected state in slate-paper with slate-ink text and shadow-sm; unselected triggers are muted-foreground. Content panels sit below with a top margin. Mobile treatment follows the container's responsive padding.

### Chips (if used)
Not currently a shared component; select items use rounded-sm pills with px-2 py-1.5 padding, accent background on hover/highlight.

## Do's and Don'ts

### Do:
- **Do** use Slate Deep (primary ink) on ≤10% of any given screen; its rarity is the point.
- **Do** keep focus rings visible: 2px slate-ring with 2px offset on every interactive control.
- **Do** carry heading hierarchy by weight and size only (800 → 700 → 600 → 500 → 400); never add a second typeface.
- **Do** reserve TikTok red (#fe2c55) and cyan (#25f4ee) for TikTok brand touchpoints only.

### Don't:
- **Don't** use gradient text, glass/blur as decoration, or zero-blur block shadows (`4px 4px 0`) — this world is flat-by-default.
- **Don't** add eyebrows/kickers above headings or section numbers (01/02/03); the heading carries its own weight.
- **Don't** nest cards; cards are the container, never nested inside one another.
- **Don't** apply TikTok brand colors as decorative accents on agency UI.

---
