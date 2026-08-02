---
name: archify
description: Generates clean, interactive, self-contained system architecture, data-flow, sequence, and component diagrams in HTML, SVG, PNG, and WebP formats. Use when analyzing repository architecture, mapping trust boundaries, documenting data flow, or generating visual evidence for Dokion hardening reports.
---

# Archify - Interactive System Architecture & Diagram Engine

`archify` is an agent-native skill designed to produce interactive, animated, self-contained architecture diagrams directly from codebase analysis or system specifications.

When running within a **Dokion Playbook**, `archify` produces visual evidence artifacts saved to `.dokion/evidence/` or `.dokion/reports/` to support audit and hardening evidence.

---

## Capabilities & Output Formats

1. **Interactive HTML Diagrams**:
   - Animated node flows, hover states, and expandable details.
   - Built-in Dark / Light theme toggle.
   - Zero external runtime dependencies (self-contained HTML).

2. **Static & Vector Exports**:
   - SVG (vector format for documentation & READMEs).
   - PNG / WebP / JPEG (high-DPI renders for presentation).

3. **Diagram Types**:
   - **System Topology**: Services, databases, queues, external APIs, and gateways.
   - **Data Flow & Trust Boundaries**: Untrusted boundaries, auth layers, DB access patterns.
   - **Sequence & Workflow**: Step-by-step API interactions, event queues, and state machines.
   - **Dokion Playbook Pipelines**: Visualizing stage sequences, sub-agent swarms, and release gates.

---

## Execution Guidelines for Dokion Agents

When executing a stage in `.dokion/playbook.json` that invokes `archify`:

### Step 1: Scan and Inspect Codebase
- Read package manifests (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, etc.).
- Inspect main entry points, API routes, database schemas, and external integrations.
- Identify component relationships, trust boundaries, and data flow pipelines.

### Step 2: Generate Interactive Artifact
- Write the HTML diagram file to `.dokion/evidence/architecture.html` or `.dokion/reports/architecture.html`.
- Ensure the diagram includes:
  - Component nodes (Frontend, Backend, Database, Auth, External Services).
  - Data flow directional arrows with protocol labels (HTTP/REST, gRPC, WebSocket, SQL).
  - Theme toggling & interactive hover controls.

### Step 3: Record Evidence in HARDENING.md
- Record the generated artifact in `.dokion/state.json` and link it in `HARDENING.md`:
  ```markdown
  ### Visual Architecture Evidence
  - Interactive Diagram: [.dokion/evidence/architecture.html](file://.dokion/evidence/architecture.html)
  - Vector SVG: [docs/architecture.svg](file://docs/architecture.svg)
  ```

---

## Example Usage in Playbooks

```json
{
  "id": "architecture-mapping-step",
  "capability": {
    "type": "skill",
    "id": "archify",
    "version": "1.0.0",
    "source": "tt-a1i/archify"
  },
  "responsibility": "Generate interactive architecture and data flow diagrams for repository audit.",
  "mode": "READ_WRITE",
  "permissions": {
    "read": ["**/*"],
    "write": [".dokion/evidence/architecture.html", "docs/architecture.svg", "HARDENING.md"]
  }
}
```
