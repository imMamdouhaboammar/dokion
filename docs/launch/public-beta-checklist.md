# Dokion Public Beta Launch Checklist

Current launch status: **NOT READY**

This checklist must be evaluated against one exact release-candidate commit. A checked item requires a linked workflow run, committed fixture, review record, or generated evidence artifact from that commit

## Current verified foundations

- [x] `.dokion/playbook.json` is the sole execution authority
- [x] Bun `1.3.14` is the pinned runtime baseline
- [x] Claude Code, Codex, and Gemini CLI adapters are packaged, with limitations documented in `docs/compatibility.md`
- [x] Registry package build, read-only verification, and immutable artifact pull are implemented

## Required before public beta

- [ ] The committed `generated/product-surface.json` regenerates without drift
- [ ] Every documented executable command is absent from planned-only surfaces and passes packaged CLI validation
- [ ] `dokion verify` independently re-runs the active Playbook's declared test and build gates
- [ ] Non-dry `dokion autoresearch` executes through production callbacks instead of returning `UNSUPPORTED_EXECUTION`
- [ ] Secure Release passes clean-install positive and negative fixtures on supported Bun and Node TypeScript repositories
- [ ] Versioned Run Trace exports pass integrity, terminal-state, and unsafe-HTML tests
- [ ] GitHub Action positive and negative controls pass on the exact release candidate
- [ ] Full tests, typecheck, contracts, build, distribution validation, and package smoke pass on the same commit
- [ ] CodeRabbit and security review findings are resolved or explicitly rejected with evidence
- [ ] External adoption records come from real, consented repositories and contain no fabricated metrics
- [ ] Promotion sign-off references the exact commit, workflow runs, unresolved risks, and rollback instructions

No public beta, marketplace listing, launch campaign, or release-readiness claim is approved while any required item remains unchecked
