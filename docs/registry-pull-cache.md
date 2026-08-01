# Registry Pull and Immutable Cache

`dokion registry pull` performs one bounded transition:

```text
validated Registry Config source
  -> Registry Root retrieval and verification
  -> Registry Index retrieval and verification
  -> exact package resolution
  -> artifact retrieval
  -> SHA-256 digest verification
  -> immutable content-addressed cache publication
  -> cached package verification
```

## Command

```text
dokion registry pull <namespace/name@exact-version>
  --source <source-name-or-id>
  --config <registry-config-path>
  --cache <cache-root>
  [--format human|json]
```

The source, config path, cache root, package identity, and exact version are explicit inputs. Registry metadata cannot silently select or replace them.

## Supported sources

Registry v1 source types are:

- `local`: a configured local Registry directory
- `https`: an HTTPS Registry Root URL without credentials, fragments, or query parameters
- `git`: an HTTPS Git repository pinned to an exact 40-character commit and a normalized Root path

Network retrieval is bounded by the configured response size, redirect limit, and request timeout. HTTPS downgrade redirects, loops, private literal addresses, credentials, compressed responses, truncation, size mismatches, and digest mismatches fail closed.

## Cache layout

Verified artifacts use a content-addressed path derived only from the SHA-256 artifact digest:

```text
<cache-root>/
  sha256/
    ab/
      cdef.../
        artifact.dokion-package
        evidence.json
```

Publication uses temporary files, file synchronization, read-only final objects, a per-digest lock, and hard-link publication. Existing entries are never overwritten. Cache hits recompute the artifact digest, verify the Registry Index manifest digest and size, and run the package verifier with the expected package ID and exact version.

Temporary and lock paths are outside final content objects. Partial entries are rejected. Stale Dokion temporary files are cleaned only after the configured age boundary.

## Authority boundary

Pulling and caching do not:

- extract package files
- install a package
- modify the Playbooks Lockfile
- modify `.dokion/playbook.json`
- activate a package
- select a package for execution
- grant execution authority
- execute package content or lifecycle scripts

`.dokion/playbook.json` remains the sole execution authority. Installation, lockfile mutation, activation, rollback, and execution are separate future transitions.
