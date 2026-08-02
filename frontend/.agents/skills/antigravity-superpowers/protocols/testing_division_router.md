# 🧪 Protocol 11: Testing & QA Division Router & Specialization Matrix

## 1. Overview
The global system skills directory (`~/.gemini/config/skills/`) contains 9 specialized Testing & QA Division roles (`testing-*`). This protocol establishes how Antigravity routes test automation, performance benchmarking, accessibility auditing, and quality assurance tasks across all projects.

## 2. Specialization Matrix & Role Mapping

### 🤖 Test Automation & API Validation
- `testing-test-automation-engineer`: Playwright/Cypress end-to-end automation, resilient selectors, CI parallelization, flaky test elimination.
- `testing-api-tester`: API contract testing, load/stress validation, mock servers, and third-party integration QA.
- `testing-test-results-analyzer`: Automated test failure triaging, failure root cause classification, regression metrics reporting.

### ⚡ Performance, Accessibility & Reality Auditing
- `testing-performance-benchmarker`: Measure, profile, and optimize LCP/INP metrics, memory footprints, API latency, and load bottlenecks.
- `testing-accessibility-auditor`: WCAG 2.1 AA/AAA auditing, screen reader compatibility, ARIA landmark validation, keyboard navigation testing.
- `testing-reality-checker`: Evidence-based certification gatekeeper; rejects fantasy approvals and requires empirical proof before production release.

### 📸 Evidence, Evaluation & Workflow Optimization
- `testing-evidence-collector`: Screenshot and video proof collector; records concrete visual evidence for all UI/UX implementations.
- `testing-tool-evaluator`: Benchmarks testing tools, frameworks, and QA infrastructure for efficiency and speed.
- `testing-workflow-optimizer`: Optimizes CI/CD test execution pipelines, parallelization matrices, and test suite execution time.

## 3. QA Execution Workflow
1. **Testing Requirement Identification**: Determine if the task requires unit tests, E2E browser automation, API contract validation, or visual proof.
2. **Specialized QA Dispatch**: Dispatch subagents using `invoke_subagent` with the selected `testing-*` role.
3. **Evidence Certification**: Ensure all test suites pass with green assertions and visual/log evidence before declaring completion.
