# Unslop Source Fixes Report

This document records the exact source code edits applied by Unslop Preflight Autopilot, along with detailed explanations and verification strategies.

## Modification Ledger
- **Applied Patches:** 0
- **Skipped Patches:** 103

---

## Applied Source Patches

No automatic source patches were applied in this run.

## Skipped Patches (Safe / Defensive Omissions)

### [Skipped] `modal/dialog without accessible name (M1)`
- **File:** `src/components/SetupMCPModal.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-without-focus-trap`
- **File:** `src/components/SetupMCPModal.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/components/SetupMCPModal.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-without-focus-trap`
- **File:** `src/components/SetupMCPModal.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `overlay-missing-portal`
- **File:** `src/components/SetupMCPModal.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `blanket overflow:hidden on layout container (D2)`
- **File:** `src/views/CreationMethodPicker.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `focus outline removed, verify focus-visible fallback (A2/A4)`
- **File:** `src/views/CreationMethodPicker.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/CreationMethodPicker.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-width-mobile-risk`
- **File:** `src/views/CreationMethodPicker.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `blind-overflow-hidden`
- **File:** `src/views/CreationMethodPicker.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `blanket overflow:hidden on layout container (D2)`
- **File:** `src/views/GitHub.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/GitHub.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `blind-overflow-hidden`
- **File:** `src/views/GitHub.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/GitHub.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `focus outline removed, verify focus-visible fallback (A2/A4)`
- **File:** `src/views/Home.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `focus outline removed, verify focus-visible fallback (A2/A4)`
- **File:** `src/views/Home.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `focus outline removed, verify focus-visible fallback (A2/A4)`
- **File:** `src/views/Home.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `focus outline removed, verify focus-visible fallback (A2/A4)`
- **File:** `src/views/Home.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `focus outline removed, verify focus-visible fallback (A2/A4)`
- **File:** `src/views/Home.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/Home.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `image-without-loading`
- **File:** `src/views/Settings.tsx`
- **Reason for Omission:** unsafe
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `blanket overflow:hidden on layout container (D2)`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `collection-map-empty-state-review`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `async-view-state-review`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `array-index-key-reorder-risk`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `oversized-typography-mobile-risk`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `blind-overflow-hidden`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `oversized-typography-mobile-risk`
- **File:** `src/views/SkillsSh.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `transition-all-animation-slop`
- **File:** `src/views/Validation.tsx`
- **Reason for Omission:** unsafe
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `image-without-loading`
- **File:** `src/components/Layout.tsx`
- **Reason for Omission:** unsafe
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `hardcoded-color-token-drift`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-inside-transform-bug`
- **File:** `src/index.css`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `transition-all-animation-slop`
- **File:** `src/views/Chat.tsx`
- **Reason for Omission:** unsafe
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `oversized-typography-mobile-risk`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-inside-transform-bug`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-inside-transform-bug`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `array-index-key-reorder-risk`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-width-mobile-risk`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-inside-transform-bug`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-inside-transform-bug`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `fixed-inside-transform-bug`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `sidebar-missing-active-state`
- **File:** `src/views/Editor.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---
### [Skipped] `modal-internal-scroll-risk`
- **File:** `src/views/Library.tsx`
- **Reason for Omission:** no-fixer
- **Recommended Fix Strategy:** Handle manually

---