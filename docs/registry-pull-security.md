# Registry Pull Security Invariants

The Registry pull runtime preserves these invariants:

- Package selection requires an explicit source plus `namespace/name@exact-version`.
- Registry Config, Root, and Index documents carry no selection, substitution, installation, activation, or execution authority.
- Root references bind Index bytes by exact SHA-256 digest and size.
- Index entries bind artifact and manifest bytes by exact SHA-256 digest and size.
- Package identity is read from the verified package manifest, never from the filename.
- Source files, cache files, lock files, and temporary files use no-follow semantics.
- Registry filesystem paths reject symlinked intermediate components.
- Cache directories are created and checked one component at a time.
- Git sources require HTTPS and an exact commit, disable credential helpers and redirects, and reject non-HTTPS protocols.
- Cache objects are content-addressed, read-only, and never overwritten.
- A cache hit recomputes the artifact digest and reruns package verification.
- Evidence contains source identity and immutable digests, not credentials, cookies, authorization headers, or signed URLs.
- Pull does not extract, install, activate, select for execution, or mutate project Playbook authority.
