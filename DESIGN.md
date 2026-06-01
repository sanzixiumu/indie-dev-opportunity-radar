---
name: Insightful Developer Core
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#904900'
  on-tertiary: '#ffffff'
  tertiary-container: '#b55d00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The brand personality is authoritative yet accessible, designed specifically for software engineering and technical analysis. It evokes a sense of clarity, precision, and systematic intelligence. 

The design style is **Corporate Modern with a Developer-Centric focus**. It prioritizes high-density information display without sacrificing aesthetic cleanliness. The visual language uses a light, airy canvas to reduce cognitive load, punctuated by vibrant accents that signal interactivity and "smart" features. The overall feel is that of a premium IDE or a high-end technical dashboard: reliable, straightforward, and highly functional.

## Colors
This design system utilizes a high-contrast light mode palette. 

- **Primary & Secondary:** A vibrant Indigo (#6366f1) and Blue (#3b82f6) are used for primary actions, progress indicators, and active states. These colors provide energy against the neutral background.
- **Surface & Background:** The base surface is a pure white (#ffffff) to maximize brightness. Secondary containers and background fills use a cool light gray (#f8fafc) to create subtle hierarchy.
- **Typography:** Text is rendered in a deep Navy (#0f172a). This ensures maximum readability and a professional, "ink-on-paper" feel for long-form technical documentation.
- **Accents:** Borders and dividers use a soft slate gray (#e2e8f0) to define structure without adding visual noise.

## Typography
The system relies exclusively on **Inter** to maintain a systematic, utilitarian aesthetic. 

- **Headlines:** Use tighter letter-spacing and heavier weights to create a strong visual anchor.
- **Body:** Standardized at 16px for optimal legibility in technical contexts, with a generous line-height to improve scanning.
- **Labels:** Used for metadata, button text, and small UI hints. Small labels use a slightly heavier weight and uppercase styling to differentiate them from body text.
- **Responsiveness:** Large headlines scale down on mobile to prevent awkward line breaks while maintaining their relative hierarchy.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a strict 4px baseline rhythm.

- **Desktop:** 12-column grid with 24px gutters. Content is typically contained within a max-width of 1280px.
- **Tablet:** 8-column grid with 24px gutters and 24px side margins.
- **Mobile:** 4-column grid with 16px gutters and 16px side margins.
- **Spacing Logic:** All padding and margins must be multiples of 4px. Use `md` (16px) for standard component spacing and `lg` (24px) for section-level separation.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows.

- **Level 0 (Base):** The #ffffff surface.
- **Level 1 (In-page Containers):** Using #f8fafc with a 1px border of #e2e8f0. No shadow.
- **Level 2 (Interactive Cards):** White surface with a subtle 1px border and a very soft, diffused shadow (0px 4px 12px rgba(15, 23, 42, 0.05)).
- **Level 3 (Overlays/Modals):** Pure white surface with a more pronounced shadow (0px 12px 24px rgba(15, 23, 42, 0.1)) to indicate focus.

## Shapes
The design system utilizes a **Rounded (8px)** corner radius strategy to soften the technical nature of the content without appearing overly casual.

- **Standard Elements:** Buttons, Inputs, and Cards use the `rounded` (0.5rem / 8px) value.
- **Small Elements:** Tooltips and tags use `rounded-sm` (4px).
- **Large Elements:** Modals and main feature containers use `rounded-lg` (1rem / 16px).

## Components
- **Buttons:** Primary buttons are solid Indigo (#6366f1) with white text. Secondary buttons use a light gray fill (#f1f5f9) with Navy text.
- **Input Fields:** Use #ffffff background with a 1px #e2e8f0 border. On focus, the border changes to Indigo with a subtle 2px outer glow.
- **Chips/Tags:** Small, #f1f5f9 background with Navy text (#0f172a). For status-specific tags, use low-opacity versions of the primary/secondary colors.
- **Lists:** Clean lines with 1px #e2e8f0 dividers. Interactive list items should have a hover state of #f8fafc.
- **Cards:** White background, 8px corner radius, and a 1px border. Avoid shadows unless the card is draggable or floating.
- **Data Tables:** High-density layout, no vertical borders, only horizontal dividers. Header cells should have #f8fafc background and bold 12px uppercase text.