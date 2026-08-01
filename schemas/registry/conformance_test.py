#!/usr/bin/env python3
"""Offline JSON Schema conformance for the Dokion Registry protocol."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker, RefResolver
from jsonschema.exceptions import SchemaError

ROOT = Path(__file__).resolve().parent
VALID_FIXTURES = ROOT / "fixtures" / "valid"
INVALID_FIXTURES = ROOT / "fixtures" / "invalid"

FIXTURE_SCHEMAS = {
    "registry-root": "dokion.registry-root.v1.schema.json",
    "registry-index": "dokion.registry-index.v1.schema.json",
    "package-manifest": "dokion.package-manifest.v1.schema.json",
    "registry-config": "dokion.registry-config.v1.schema.json",
    "playbooks-lock": "dokion.playbooks-lock.v1.schema.json",
    "provenance": "dokion.provenance.v1.schema.json",
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def fixture_contract(path: Path) -> str:
    name = path.stem
    for prefix, schema_file in FIXTURE_SCHEMAS.items():
        if name == prefix or name.startswith(f"{prefix}-"):
            return schema_file
    raise ValueError(f"No schema mapping for fixture {path.name}")


def main() -> int:
    schema_paths = sorted(ROOT.glob("*.schema.json"))
    if not schema_paths:
        print("No Registry schemas found", file=sys.stderr)
        return 1

    schemas = {path.name: load_json(path) for path in schema_paths}
    store: dict[str, dict[str, Any]] = {}

    for path in schema_paths:
        schema = schemas[path.name]
        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError as error:
            print(f"INVALID SCHEMA: {path}: {error.message}", file=sys.stderr)
            return 1
        schema_id = schema.get("$id")
        if not isinstance(schema_id, str) or not schema_id:
            print(f"MISSING $id: {path}", file=sys.stderr)
            return 1
        if schema_id in store:
            print(f"DUPLICATE $id: {schema_id}", file=sys.stderr)
            return 1
        store[schema_id] = schema

    failures: list[str] = []

    for fixture_path in sorted(VALID_FIXTURES.glob("*.json")):
        schema = schemas[fixture_contract(fixture_path)]
        resolver = RefResolver.from_schema(schema, store=store)
        validator = Draft202012Validator(schema, resolver=resolver, format_checker=FormatChecker())
        errors = sorted(validator.iter_errors(load_json(fixture_path)), key=lambda error: list(error.absolute_path))
        if errors:
            rendered = "; ".join(error.message for error in errors)
            failures.append(f"VALID fixture rejected: {fixture_path.name}: {rendered}")

    for fixture_path in sorted(INVALID_FIXTURES.glob("*.json")):
        schema = schemas[fixture_contract(fixture_path)]
        resolver = RefResolver.from_schema(schema, store=store)
        validator = Draft202012Validator(schema, resolver=resolver, format_checker=FormatChecker())
        errors = list(validator.iter_errors(load_json(fixture_path)))
        if not errors:
            failures.append(f"INVALID fixture accepted: {fixture_path.name}")

    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        return 1

    print(
        f"Registry protocol conformance passed: {len(schema_paths)} schemas, "
        f"{len(list(VALID_FIXTURES.glob('*.json')))} valid fixtures, "
        f"{len(list(INVALID_FIXTURES.glob('*.json')))} invalid fixtures"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
