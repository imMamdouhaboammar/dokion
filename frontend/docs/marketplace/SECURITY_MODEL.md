# Dokion Playbooks Marketplace Security Model

## Threat Model & Principles
Dokion Playbooks contain executable workflows, security rules, and analysis logic. Uploaded packages are treated as **potentially hostile untrusted code**.

### Core Controls
1. **Archive Security**:
   - File type allowlist (`.yaml`, `.yml`, `.json`, `.md`, `.ts`, `.js`, `.py`, `.sh`, `.schema.json`).
   - Max package archive size: 25MB compressed, 100MB uncompressed limit.
   - Zip bomb / compression ratio caps (max 10x ratio).
   - Strict path normalization rejecting directory traversal (`../`, absolute paths).
   - Symlinks rejected or resolved strictly within sandbox boundary.

2. **Permission Declarations**:
   - Every Playbook must explicitly declare filesystem read/write paths, network access requirements, shell execution, and secret access.
   - The installer displays permissions prior to activation.

3. **Isolated Test Execution**:
   - Package test fixtures are executed in disposable isolated environments with CPU, memory, and timeout limits (e.g., 30s execution timeout).
   - No production secrets or external network credentials exposed to runners.

4. **Package Integrity**:
   - Content-addressed SHA-256 hash calculated upon upload.
   - Cryptographic Ed25519 signature verified prior to CLI download and installation.
   - Short-lived signed URLs (15-minute expiration) for package byte downloads.

5. **Entitlement & Download Protection**:
   - Server-side license entitlement verification before generating signed URLs for paid packages.
   - Idempotent payment webhook processing with signature verification.
