# 🏛️ Protocol 9: Engineering Division Router & Specialization Matrix

## 1. Overview
The global system skills directory (`~/.gemini/config/skills/`) contains 57 specialized engineering division roles (`engineering-*`). This protocol establishes how Antigravity routes and delegates subagent tasks to the corresponding specialized role globally across all projects.

## 2. Specialization Matrix & Role Mapping

### 💻 Architecture & Core Engineering
- `engineering-software-architect`: System design, DDD, bounded contexts, ADRs, C4 models.
- `engineering-backend-architect`: Database schemas, microservices, REST/gRPC APIs, scalability.
- `engineering-frontend-developer`: React/Vue/Angular, state management, CSS architectures, performance.
- `engineering-senior-developer`: Complex full-stack implementations, advanced UI/UX, state machines.
- `engineering-code-reviewer`: Code reviews, correctness, maintainability, security, unslop.
- `engineering-minimal-change-engineer`: Minimum-viable diffs, scope-creep prevention, bug isolation.

### 🤖 AI, ML & RAG Engineering
- `engineering-ai-engineer`: ML model integration, inference pipelines, production AI services.
- `engineering-prompt-engineer`: Prompt optimization, chain-of-thought, few-shot tuning, evaluation.
- `engineering-rag-pipeline-engineer`: Chunking strategies, hybrid search, vector embeddings, re-ranking.
- `engineering-llm-post-training-engineer`: SFT, preference optimization (DPO/RLHF), model evaluation.
- `engineering-multi-agent-systems-architect`: Multi-agent orchestration, context sharing, inter-agent trust.
- `engineering-ai-data-remediation-engineer`: Dataset cleaning, deduplication, synthetic data generation.

### ☁️ Infrastructure, DevOps & Security
- `engineering-devops-automator`: Infrastructure as Code (Terraform), CI/CD pipelines, Docker/Kubernetes.
- `engineering-sre`: Observability, SLO/SLI tracking, error budgets, incident response.
- `engineering-incident-response-commander`: Production incident management, post-mortems, on-call procedures.
- `engineering-finops-engineer`: Cloud cost allocation, RI/Savings Plans, unit economics optimization.
- `engineering-identity-access-engineer`: OAuth 2.0/OIDC, SAML/SSO, Passkeys, RBAC/ABAC authorization.
- `engineering-privacy-engineer`: PII discovery, automated DSAR, data minimization, consent enforcement.

### 🗄️ Database & Search Engineering
- `engineering-database-optimizer`: PostgreSQL/MySQL/Supabase indexing, query tuning, EXPLAIN analysis.
- `engineering-database-reliability-engineer`: High availability, zero-downtime online migrations, replication.
- `engineering-search-relevance-engineer`: Elasticsearch/OpenSearch indexing, BM25 + vector hybrid retrieval.

### 📱 Mobile, Desktop & IoT Engineering
- `engineering-mobile-app-builder`: Native iOS/Android, React Native, Flutter, Expo.
- `engineering-mobile-release-engineer`: Code signing, Fastlane, App Store & Google Play distribution.
- `engineering-desktop-app-engineer`: Electron & Tauri, IPC security, notarization, auto-updates.
- `engineering-iot-fleet-engineer`: Device provisioning, MQTT, staged OTA firmware updates, telemetry.
- `engineering-embedded-firmware-engineer`: Bare-metal & RTOS firmware (ESP32, STM32, ARM Cortex-M).

### 🌐 Specialized Domains & Integrations
- `engineering-api-platform-engineer`: OpenAPI contracts, rate limiting, SDK generation, DX.
- `engineering-payments-billing-engineer`: Stripe/Adyen, subscription billing, SCA/3DS, PCI scope reduction.
- `engineering-realtime-collaboration-engineer`: WebSocket/SSE, CRDTs, offline-first sync engines.
- `engineering-video-streaming-engineer`: HLS/DASH packaging, ffmpeg transcode ladders, CMAF low-latency.
- `engineering-webassembly-engineer`: Wasm compilation (Rust/C++/Go), JS interop, WASI runtimes.
- `engineering-solidity-smart-contract-engineer`: EVM smart contracts, gas optimization, proxy patterns.
- `engineering-git-workflow-master`: Branching strategies, conventional commits, rebase workflows.
- `engineering-cms-developer`: Drupal/WordPress themes, custom plugins/modules, content architecture.
- `engineering-filament-optimization-specialist`: Filament PHP admin interfaces, resource optimization.

## 3. Subagent Routing Workflow
1. **Task Classification**: Identify the core technical domain(s) of the user request.
2. **Role Selection**: Select the primary and secondary engineering role(s) from `~/.gemini/config/skills/engineering-*`.
3. **Subagent Execution**: Dispatch subagents using `invoke_subagent` with the selected role's prompt and guidelines.
4. **Verification & Merge**: Reconcile results against test pass gates before finalizing code changes.
