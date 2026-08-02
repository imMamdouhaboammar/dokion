# 🎨 Protocol 4: Visual Perfection & UI Finish Gate Protocol

## 1. Overview
The UI Finish Gate ensures that all user interfaces built by Antigravity are modern, responsive, accessible, dynamic, and free from generic AI boilerplate.

## 2. Core Operational Rules
1. **Design System Tokens First**:
   - Always define semantic CSS custom properties (`--color-primary`, `--color-surface`, `--radius-md`, `--space-4`) before building layouts.
   - Avoid generic browser default color stacks (pure black/white, plain red/blue) or overused purple-on-white templates.

2. **Expressive Typography & Motion**:
   - Use Google Fonts (e.g., Inter, Outfit, Space Grotesk, Plus Jakarta Sans) with curated scale tokens.
   - Integrate subtle micro-interactions, hover states, and staggered entrance animations.

3. **No Decorative Cards inside Cards / No Slop Layouts**:
   - Avoid nesting UI cards inside other cards or floating section cards.
   - Use full-width bands or unframed responsive grid tracks with constrained inner content.

4. **Responsive & Accessible Design (a11y)**:
   - Enforce WCAG AA color contrast ratios and visible keyboard focus rings.
   - Include semantic HTML5 tags (`<main>`, `<nav>`, `<article>`, `<button>`) with unique descriptive IDs and Lucide icons.
