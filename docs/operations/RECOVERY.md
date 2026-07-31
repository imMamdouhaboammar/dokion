# Dokion Operations & Recovery Guide

## Interrupted Atomic Writes & Crash Recovery

Dokion state updates are atomic and Revision-Monotonic. If an execution process is interrupted (e.g. SIGKILL or power failure), Dokion automatically runs atomic write recovery on next invocation.

### Resuming Stale Runs
If commit drift or uncommitted changes occur:

```bash
dokion doctor
dokion status
dokion resume
```

### Emergency Rollback
To inspect transaction repair manifests or rollback:

```bash
dokion audit
```
