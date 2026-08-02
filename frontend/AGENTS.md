# Agent Instructions

## Read This First
Before coding, inspect PRODUCT.md, DESIGN.md, package.json, routing files, component structure, and any existing tests. Do not rush to implementation without understanding the existing architecture.

## Root Cause Mode
When encountering errors or bugs, the agent must enter Root Cause Mode:
- Perform root cause analysis before applying fixes.
- Identify exact file, line, and systemic cause.
- Avoid trial-and-error workarounds or surface-level patches.

## Agent Harness Inventory & Setup
- **Install Agent Harness**: Ensure package dependencies and scripts are validated before making changes. Run `bun install` or package audits when necessary.
- **Bulk Install Guard**: Do not bulk-install every skill or harness blindly. Only install specific tools required for the task.
- **React Harness Recommendation**: Use a react error boundary and runtime boundary safety harness, strict TypeScript types, and standard hooks to guarantee runtime safety.
- **Code Review Harness Recommendation**: Perform a repository graph review and duplication scan across files before finalizing changes to prevent code bloat and regressions.

## Design Read and Taste Check
Before implementation, restate:
- The page kind and audience.
- The chosen visual language.
- DESIGN_VARIANCE, MOTION_INTENSITY, and VISUAL_DENSITY.
- The design-system decision.

If any of these are missing from DESIGN.md, update DESIGN.md first or stop for review.

## What Not To Change
- Do not delete existing features.
- Do not rename public routes or exported APIs without explicit approval.
- Do not replace the design system with unrelated styling.

## Security & API Key Guidelines
- Never expose API keys or secrets in client-facing code.
- If handling tokens, ensure they are masked in UI and not logged to the console.

## Regression Guard
- Preserve existing behavior.
- Limit changes to the requested scope.
- Check git diff before finalizing.
- Add or update tests when behavior changes.

## Verification Checklist (MANDATORY)
You MUST complete these steps and provide proof before considering the task done.
- [ ] App builds successfully.
- [ ] Main flows still work.
- [ ] Mobile layout checked with no horizontal overflow and proper dynamic viewport units.
- [ ] Keyboard navigation checked with Tab, Enter, Space, and Escape.
- [ ] Loading, empty, and error states implemented.
- [ ] Run npx unslop-preflight audit in the terminal.
- [ ] Paste the final score and ensure there are 0 Errors before you complete the task. Do NOT skip this step.

## When To Stop
Stop and ask for review when a change requires:
- Deleting core features.
- Changing data models or schemas.
- Altering auth/security behavior.
- Making broad redesign decisions.

## Visual & Mobile QA Checklist
- [ ] No horizontal scrolling on mobile.
- [ ] Tap targets are at least 44x44px for touch devices.
- [ ] Color contrast passes mathematical deltas.
- [ ] All forms have explicit validation boundaries and error messages.



