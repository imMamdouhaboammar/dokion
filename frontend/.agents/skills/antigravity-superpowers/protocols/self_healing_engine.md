# 🩹 Protocol 3: Autonomous Self-Healing & Empirical Hot-Fixing Engine

## 1. Overview
The Self-Healing Engine guarantees that Antigravity diagnoses bugs using empirical evidence from error tracebacks and logs, applies root-cause fixes, and adds regression guardrails automatically.

## 2. Core Operational Rules
1. **Empirical Log Extraction First**:
   - Never form a diagnostic hypothesis without reading the exact, complete error traceback or log file.
   - If a test or command fails, immediately extract stdout/stderr and examine the stack trace.

2. **No Superficial Symptom Patching**:
   - Never swallow exceptions silently, add fake fallback defaults, comment out broken assertions, or delete failing tests.
   - Address the root-cause failure in the upstream contract or data provider.

3. **Systematic 4-Step Debugging Loop**:
   - **Step 1: Isolate**: Reproduce the error with the smallest possible test or execution script.
   - **Step 2: Hypothesize**: Form a testable hypothesis grounded in log evidence.
   - **Step 3: Fix**: Apply precise code edits to resolve the root contract violation.
   - **Step 4: Verify & Protect**: Run full test suites and add regression tests covering the fixed bug.

4. **Traceback Justification Mandate**:
   - Every debugging modification must reference an explicit line or symbol from the error traceback.
