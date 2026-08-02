# Dokion Playbook Package Specification

## Manifest Format (`playbook.yaml` / `dokion.yaml`)

A valid Dokion Playbook package must include a root manifest conforming to schema version 1:

```yaml
schema_version: 1

id: com.dokion.security-api-review
name: Secure API Review
slug: secure-api-review
version: 1.0.0

publisher:
  id: pub-dokion-official
  handle: dokion
  name: Dokion Core Team

summary: Automated REST API security analysis and compliance scanning

license:
  type: commercial # or apache-2.0, mit, proprietary
  file: LICENSE.md

compatibility:
  dokion: ">=1.8.0 <2.0.0"
  operating_systems:
    - linux
    - macos
    - windows
  runtimes:
    - node
    - python

entrypoints:
  default: playbook.yaml

permissions:
  filesystem:
    read:
      - project
    write:
      - .dokion/reports
  network:
    required: false
  shell:
    required: false

inputs:
  schema: schemas/input.schema.json

outputs:
  protocol: dokion-findings
  schema_version: 1

tests:
  fixtures: tests/fixtures
  command: tests/run.sh

metadata:
  categories:
    - Security Scanning
    - APIs
  tags:
    - api
    - rest
    - owasp
```

## Manifest Field Constraints
- `schema_version`: Must be integer `1`.
- `id`: Reverse-domain identifier (e.g. `com.publisher.name`).
- `slug`: Lowercase alphanumeric with hyphens (`[a-z0-9-]+`), 3-64 chars.
- `version`: Strict SemVer (`MAJOR.MINOR.PATCH`).
- `compatibility.dokion`: Valid semver range string.
- `permissions`: Must explicitly state all filesystem, network, and shell requirements.
- `outputs.protocol`: Must be `dokion-findings`.
