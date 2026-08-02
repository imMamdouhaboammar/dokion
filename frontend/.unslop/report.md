# Unslop Autopilot Report

## 1. Executive Summary
**Score:** 0/100
**Readiness:** blocked
**Stop reason:** no-safe-repairs
> **Decision:** Do not hand this to an AI coding agent yet. Resolve errors and blocked source issues first.


**Totals:** 31 Blockers | 99 Warnings | 9 Info

Autopilot was executed in **safe-fix** mode. It applied safe, low-risk deterministic source code fixes and verified them against available project checks.

## Before / After

| Metric | Before | After | Delta |
| :--- | :---: | :---: | :---: |
| **Unslop Score** | `0/100` | `0/100` | **+0** |
| **Blockers / Errors** | `31` | `31` | **-0** |
| **Source Findings** | `136` | `136` | **-0** |

## 2. Top Blockers

- **[`modal/dialog without accessible name (M1)`]** at `/app/applet/src/components/SetupMCPModal.tsx`
  - Root cause: Code implementation error or omission
  - Fix strategy: Fix the flagged source-level pattern, then rerun `npx unslop-preflight scan` or `npx unslop-preflight autopilot`.
  - Verify: N/A
- **[`blanket overflow:hidden on layout container (D2)`]** at `/app/applet/src/views/CreationMethodPicker.tsx`
  - Root cause: Code implementation error or omission
  - Fix strategy: Fix the flagged source-level pattern, then rerun `npx unslop-preflight scan` or `npx unslop-preflight autopilot`.
  - Verify: N/A
- **[`focus outline removed, verify focus-visible fallback (A2/A4)`]** at `/app/applet/src/views/CreationMethodPicker.tsx`
  - Root cause: Code implementation error or omission
  - Fix strategy: Fix the flagged source-level pattern, then rerun `npx unslop-preflight scan` or `npx unslop-preflight autopilot`.
  - Verify: N/A
- **[`blanket overflow:hidden on layout container (D2)`]** at `/app/applet/src/views/GitHub.tsx`
  - Root cause: Code implementation error or omission
  - Fix strategy: Fix the flagged source-level pattern, then rerun `npx unslop-preflight scan` or `npx unslop-preflight autopilot`.
  - Verify: N/A
- **[`focus outline removed, verify focus-visible fallback (A2/A4)`]** at `/app/applet/src/views/Home.tsx`
  - Root cause: Code implementation error or omission
  - Fix strategy: Fix the flagged source-level pattern, then rerun `npx unslop-preflight scan` or `npx unslop-preflight autopilot`.
  - Verify: N/A

## 3. Source Scan Stats

- Files scanned: 17
- Files skipped: 0
- Source findings: 136
- Scanner failures: 0
- Duration: 81ms
- Scanners run: ui, accessibility, modular
- Scanners skipped: none

## 5. Pass History

| Pass | Before | After | Safe repairs | Source findings | Scanner failures | Stop reason |
|------|--------|-------|--------------|-----------------|------------------|-------------|
| 1 | 0 (blocked) | 0 (blocked) | 0 | 136 | 0 | no-safe-repairs |

## 6. Safe Documentation Repairs Applied

No safe documentation repairs were applied.

## 7. Source Code Issues Requiring Manual/Agent Action

- **modal/dialog without accessible name (M1)** at `/app/applet/src/components/SetupMCPModal.tsx:22`: <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mcp-modal-title">
- **blanket overflow:hidden on layout container (D2)** at `/app/applet/src/views/CreationMethodPicker.tsx:218`: <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm relative overflow-hidden group">
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/CreationMethodPicker.tsx:231`: className="w-full text-left bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm hover:border-primary transition-colors cursor-poi
- **blanket overflow:hidden on layout container (D2)** at `/app/applet/src/views/GitHub.tsx:227`: <div className="bg-surface-container-low rounded-2xl border border-outline-variant/40 overflow-hidden shadow-sm">
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Home.tsx:145`: className="text-sm text-primary font-semibold hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary roun
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Home.tsx:188`: className="bg-on-surface text-surface px-8 py-3.5 rounded-xl font-bold hover:bg-on-surface/90 transition-colors focus-visible:outline-none focus-visible:ring-2 
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Home.tsx:204`: className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary/40 hover:bg-primary/5 t
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Home.tsx:222`: className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:shadow-md transition-shadow flex flex-col h-full text-left w-full foc
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Home.tsx:231`: className="text-outline hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1"
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Settings.tsx:156`: className="px-4 py-2 bg-error text-white rounded-lg text-sm font-bold hover:bg-error/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-
- **blanket overflow:hidden on layout container (D2)** at `/app/applet/src/views/SkillsSh.tsx:334`: <div className="bg-primary-container rounded-2xl p-8 border border-primary/20 shadow-sm relative overflow-hidden">
- **decorative glass default (anti-slop)** at `/app/applet/src/views/Validation.tsx:133`: <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl">
- **decorative glass default (anti-slop)** at `/app/applet/src/views/Validation.tsx:140`: <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl border border-white/20">
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Validation.tsx:174`: <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Validation.tsx:190`: <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Validation.tsx:206`: <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round
- **focus outline removed, verify focus-visible fallback (A2/A4)** at `/app/applet/src/views/Validation.tsx:222`: <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round
- **heading level jumps from h3 to h5 (skipped level)** at `/app/applet/src/views/Validation.tsx:263`: <h5>
- **image-without-size-review** at `/app/applet/src/components/Layout.tsx:70`: Image needs an explicit sizing contract to prevent layout shift.
- **modal-without-focus-trap** at `/app/applet/src/components/SetupMCPModal.tsx:22`: <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mcp-modal-title">
- **modal-internal-scroll-risk** at `/app/applet/src/components/SetupMCPModal.tsx:45`: <div className="flex-1 overflow-y-auto px-6 pb-2 custom-scrollbar">
- **modal-without-focus-trap** at `/app/applet/src/components/SetupMCPModal.tsx:22`: Detected dialog without focus trap. Modals must trap focus for accessibility.
- **overlay-missing-portal** at `/app/applet/src/components/SetupMCPModal.tsx:22`: High z-index overlay detected without a Portal. Use portals for safe stacking.
- **hardcoded-color-token-drift** at `/app/applet/src/index.css:48`: Hardcoded color found. Move durable color decisions into tokens or theme files.
- **hardcoded-color-token-drift** at `/app/applet/src/index.css:49`: Hardcoded color found. Move durable color decisions into tokens or theme files.

## 8. Evidence Table

| Severity | Type | Rule | Location | Symptom / Excerpt | Confidence |
|----------|------|------|----------|-------------------|------------|
| ERROR | ui | `modal/dialog without accessible name (M1)` | `/app/applet/src/components/SetupMCPModal.tsx:22` | <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mcp-modal-title"> | high |
| ERROR | ui | `blanket overflow:hidden on layout container (D2)` | `/app/applet/src/views/CreationMethodPicker.tsx:218` | <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm relative overflow-hidden group"> | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/CreationMethodPicker.tsx:231` | className="w-full text-left bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm hover:border-primary transition-colors cursor-poi | high |
| ERROR | ui | `blanket overflow:hidden on layout container (D2)` | `/app/applet/src/views/GitHub.tsx:227` | <div className="bg-surface-container-low rounded-2xl border border-outline-variant/40 overflow-hidden shadow-sm"> | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Home.tsx:145` | className="text-sm text-primary font-semibold hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary roun | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Home.tsx:188` | className="bg-on-surface text-surface px-8 py-3.5 rounded-xl font-bold hover:bg-on-surface/90 transition-colors focus-visible:outline-none focus-visible:ring-2  | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Home.tsx:204` | className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary/40 hover:bg-primary/5 t | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Home.tsx:222` | className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:shadow-md transition-shadow flex flex-col h-full text-left w-full foc | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Home.tsx:231` | className="text-outline hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1" | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Settings.tsx:156` | className="px-4 py-2 bg-error text-white rounded-lg text-sm font-bold hover:bg-error/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus- | high |
| ERROR | ui | `blanket overflow:hidden on layout container (D2)` | `/app/applet/src/views/SkillsSh.tsx:334` | <div className="bg-primary-container rounded-2xl p-8 border border-primary/20 shadow-sm relative overflow-hidden"> | high |
| ERROR | ui | `decorative glass default (anti-slop)` | `/app/applet/src/views/Validation.tsx:133` | <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl"> | high |
| ERROR | ui | `decorative glass default (anti-slop)` | `/app/applet/src/views/Validation.tsx:140` | <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl border border-white/20"> | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Validation.tsx:174` | <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Validation.tsx:190` | <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Validation.tsx:206` | <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round | high |
| ERROR | ui | `focus outline removed, verify focus-visible fallback (A2/A4)` | `/app/applet/src/views/Validation.tsx:222` | <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary round | high |
| ERROR | a11y | `heading level jumps from h3 to h5 (skipped level)` | `/app/applet/src/views/Validation.tsx:263` | <h5> | high |
| WARNING | modular | `image-without-size-review` | `/app/applet/src/components/Layout.tsx:70` | Image needs an explicit sizing contract to prevent layout shift. | high |
| ERROR | modular | `modal-without-focus-trap` | `/app/applet/src/components/SetupMCPModal.tsx:22` | <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mcp-modal-title"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/components/SetupMCPModal.tsx:45` | <div className="flex-1 overflow-y-auto px-6 pb-2 custom-scrollbar"> | high |
| ERROR | modular | `modal-without-focus-trap` | `/app/applet/src/components/SetupMCPModal.tsx:22` | Detected dialog without focus trap. Modals must trap focus for accessibility. | high |
| WARNING | modular | `overlay-missing-portal` | `/app/applet/src/components/SetupMCPModal.tsx:22` | High z-index overlay detected without a Portal. Use portals for safe stacking. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:48` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:49` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:50` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:51` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:53` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:54` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:55` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:56` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:58` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:59` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:60` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:61` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:66` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:67` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:68` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:69` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:70` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:71` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:72` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:73` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:74` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:75` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:77` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:78` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:80` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:81` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:82` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:83` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:87` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:88` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:89` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:90` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:92` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:93` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:94` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:95` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:97` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:98` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:99` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:100` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:105` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:106` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:107` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:108` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:109` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:110` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:111` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:112` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:113` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:114` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:116` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:117` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:119` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:120` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:121` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| WARNING | modular | `hardcoded-color-token-drift` | `/app/applet/src/index.css:122` | Hardcoded color found. Move durable color decisions into tokens or theme files. | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/index.css:139` | text-transform: none; | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/views/Chat.tsx:180` | <span className={`w-4 h-4 bg-primary rounded-full transition-transform shadow-sm ${compareMode ? 'translate-x-4' : 'translate-x-0'}`}></span> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Chat.tsx:186` | <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-8 space-y-10 max-w-4xl mx-auto w-full hide-scrollbar pb-48 md:pb-32"> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Chat.tsx:204` | <p className="text-on-surface leading-relaxed text-[15px] whitespace-pre-wrap"> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Chat.tsx:216` | <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Base Model</span> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Chat.tsx:228` | <p className="text-secondary leading-relaxed italic text-[14px] whitespace-pre-wrap"> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Chat.tsx:239` | <span className="text-[10px] font-bold text-primary uppercase tracking-widest">With {skill?.name \|\| 'Skill'}</span> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Chat.tsx:251` | <p className="text-on-surface leading-relaxed text-[14px] whitespace-pre-wrap"> | high |
| INFO | modular | `transition-all-animation-slop` | `/app/applet/src/views/Chat.tsx:265` | Broad transition-all found. Prefer targeted transition properties. | high |
| ERROR | modular | `fixed-width-mobile-risk` | `/app/applet/src/views/Chat.tsx:309` | <aside className="hidden lg:flex flex-col w-80 xl:w-96 bg-surface-container-low border-l border-outline-variant z-20 transition-all duration-300"> | high |
| INFO | modular | `transition-all-animation-slop` | `/app/applet/src/views/Chat.tsx:309` | Broad transition-all found. Prefer targeted transition properties. | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Chat.tsx:323` | <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar pb-24"> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Chat.tsx:204` | Oversized text utility found without a responsive constraint. This will break mobile layouts. | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/CreationMethodPicker.tsx:110` | <main className="flex-1 flex min-h-0 overflow-y-auto"> | high |
| ERROR | modular | `fixed-width-mobile-risk` | `/app/applet/src/views/CreationMethodPicker.tsx:213` | <aside className="hidden xl:block w-80 bg-surface-container-low border-l border-outline-variant/60 p-8 space-y-8"> | high |
| WARNING | modular | `blind-overflow-hidden` | `/app/applet/src/views/CreationMethodPicker.tsx:218` | <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm relative overflow-hidden group"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Editor.tsx:126` | <div className="flex-1 overflow-y-auto p-3 space-y-2 hide-scrollbar"> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Editor.tsx:130` | <div className="text-[10px] text-secondary mt-1">Autosaved</div> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Editor.tsx:136` | <section className="flex-1 min-h-0 overflow-y-auto bg-surface-bright p-6 md:p-10 hide-scrollbar pb-40 md:pb-24"> | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/views/Editor.tsx:205` | <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${skill.tools?.webSearch ? 'translate-x-4' : 'translate-x-0'}`} /> | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/views/Editor.tsx:221` | <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${skill.tools?.codeInterpreter ? 'translate-x-4' : 'translate-x-0'}`} /> | high |
| WARNING | modular | `array-index-key-reorder-risk` | `/app/applet/src/views/Editor.tsx:294` | Array index key detected. Confirm the list cannot reorder, insert, filter, or delete items. | high |
| ERROR | modular | `fixed-width-mobile-risk` | `/app/applet/src/views/Editor.tsx:318` | <aside className="hidden xl:flex flex-col w-[400px] border-l border-outline-variant bg-surface"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Editor.tsx:333` | <div className="flex-1 p-6 overflow-y-auto space-y-6 hide-scrollbar"> | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/views/Editor.tsx:383` | className={`absolute bottom-0 left-0 right-0 border-t border-outline-variant bg-surface-container-lowest flex items-center px-6 justify-between z-20 transition-transform duration-300 ${ | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/views/Editor.tsx:384` | isHealthBarOpen ? 'h-14 translate-y-0' : 'h-14 translate-y-[calc(100%-4px)]' | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/views/Editor.tsx:391` | className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-3 bg-surface-container-lowest border border-outline-variant border-b-0 rounded-t-full flex items-center justify-center cursor-pointer hover:bg-surface-container | high |
| WARNING | modular | `sidebar-missing-active-state` | `/app/applet/src/views/Editor.tsx:1` | Sidebar is missing active link semantic handling (e.g., aria-current="page" or specific active class). | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/GitHub.tsx:169` | <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16"> | high |
| WARNING | modular | `blind-overflow-hidden` | `/app/applet/src/views/GitHub.tsx:227` | <div className="bg-surface-container-low rounded-2xl border border-outline-variant/40 overflow-hidden shadow-sm"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/GitHub.tsx:232` | <div className="p-6 font-mono text-sm text-on-surface-variant space-y-3 max-h-[500px] overflow-y-auto"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Home.tsx:66` | <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Library.tsx:15` | <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Settings.tsx:49` | <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16 relative"> | high |
| WARNING | modular | `image-without-size-review` | `/app/applet/src/views/Settings.tsx:81` | Image needs an explicit sizing contract to prevent layout shift. | high |
| WARNING | modular | `overlay-missing-portal` | `/app/applet/src/views/Settings.tsx:51` | High z-index overlay detected without a Portal. Use portals for safe stacking. | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Settings.tsx:49` | Modal with scrollable content lacks a max-height cap, risking cutoff on small viewports. | high |
| WARNING | modular | `collection-map-empty-state-review` | `/app/applet/src/views/SkillsSh.tsx:114` | Collection rendering appears to lack an empty state. | high |
| WARNING | modular | `async-view-state-review` | `/app/applet/src/views/SkillsSh.tsx:41` | Async view should prove loading, error, and empty states before handoff. | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/SkillsSh.tsx:162` | <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface pb-32 md:pb-16"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/SkillsSh.tsx:235` | <div className="bg-surface-container rounded-xl p-4 h-[300px] overflow-y-auto font-mono text-sm"> | high |
| WARNING | modular | `array-index-key-reorder-risk` | `/app/applet/src/views/SkillsSh.tsx:239` | Array index key detected. Confirm the list cannot reorder, insert, filter, or delete items. | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/SkillsSh.tsx:240` | <span className="material-symbols-outlined text-[16px] opacity-70"> | high |
| WARNING | modular | `blind-overflow-hidden` | `/app/applet/src/views/SkillsSh.tsx:334` | <div className="bg-primary-container rounded-2xl p-8 border border-primary/20 shadow-sm relative overflow-hidden"> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/SkillsSh.tsx:240` | Oversized text utility found without a responsive constraint. This will break mobile layouts. | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Validation.tsx:48` | <div className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto hide-scrollbar"> | high |
| WARNING | modular | `modal-internal-scroll-risk` | `/app/applet/src/views/Validation.tsx:75` | <main className="flex-1 overflow-y-auto bg-surface-bright p-6 md:p-10 hide-scrollbar pb-40 md:pb-24"> | high |
| ERROR | modular | `fixed-inside-transform-bug` | `/app/applet/src/views/Validation.tsx:99` | <svg className="w-full h-full transform -rotate-90"> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Validation.tsx:168` | <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded uppercase tracking-wider">Passed</span> | high |
| INFO | modular | `transition-all-animation-slop` | `/app/applet/src/views/Validation.tsx:232` | Broad transition-all found. Prefer targeted transition properties. | high |
| INFO | modular | `transition-all-animation-slop` | `/app/applet/src/views/Validation.tsx:244` | Broad transition-all found. Prefer targeted transition properties. | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Validation.tsx:250` | <span className="text-[10px] font-bold bg-surface-container-highest text-secondary px-2 py-0.5 rounded uppercase">Blocker</span> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Validation.tsx:251` | <span className="text-[10px] font-bold text-outline">ID: SK-1029</span> | high |
| INFO | modular | `transition-all-animation-slop` | `/app/applet/src/views/Validation.tsx:256` | Broad transition-all found. Prefer targeted transition properties. | high |
| INFO | modular | `transition-all-animation-slop` | `/app/applet/src/views/Validation.tsx:268` | Broad transition-all found. Prefer targeted transition properties. | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Validation.tsx:274` | <span className="text-[10px] font-bold bg-surface-container-highest text-secondary px-2 py-0.5 rounded uppercase">Warning</span> | high |
| WARNING | modular | `oversized-typography-mobile-risk` | `/app/applet/src/views/Validation.tsx:275` | <span className="text-[10px] font-bold text-outline">ID: SK-1044</span> | high |
| INFO | harness | `missing-skill-frontend-ui-engineering` | `N/A` | Complex UI framework detected without explicit UI engineering guards. | high |
| INFO | harness | `missing-skill-chrome-devtools` | `N/A` | Web project detected. Agent lacks live browser validation. | high |
| INFO | harness | `missing-skill-a11y-debugging` | `N/A` | High risk of inaccessible modals, missing ARIA tags, and bad contrast. | high |

## Verification Results

| Command | Status | Duration | Exit Code | Summary |
|---------|--------|----------|-----------|---------|
| `npm run typecheck` | **SKIPPED** | 0ms | 0 | No script 'typecheck' found in package.json |
| `npm run lint` | **FAILED** | 8287ms | 2 |  > react-example@0.0.0 lint > tsc --noEmit  agent/skills/unslop-preflight/tests/fixtures/standards-violations/src/components/ViolatingComponent.tsx(2, |
| `npm run test` | **SKIPPED** | 0ms | 0 | No script 'test' found in package.json |
| `npm run build` | **PASSED** | 4446ms | 0 |  > react-example@0.0.0 build > vite build  vite v6.4.1 building for production... transforming... ✓ 76 modules transformed. rendering chunks... comput |

## 9. Verification Notes

Review PRODUCT.md, DESIGN.md, AGENTS.md, package.json, routing files, component structure, existing tests, and `.unslop/fix-list.md`. Documentation repairs do not prove implementation quality. Run tests, browser QA, accessibility checks, and Unslop again before release.

## 10. Verification Checklist
- [ ] Build succeeds without errors
- [ ] Tests pass
- [ ] Mobile viewports checked
- [ ] Keyboard navigation and focus traps work
- [ ] RTL layout checked if applicable
- [ ] Overlays and modals render correctly without scroll cutoff