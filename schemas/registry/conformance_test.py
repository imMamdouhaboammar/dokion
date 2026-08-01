#!/usr/bin/env python3
"""Offline JSON Schema and semantic conformance for the Dokion Registry protocol."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError, ValidationError
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parent
VALID_FIXTURES = ROOT / "fixtures" / "valid"
INVALID_FIXTURES = ROOT / "fixtures" / "invalid"
EXPECTATIONS_PATH = ROOT / "invalid-fixture-expectations.json"

FIXTURE_SCHEMAS = {
    "registry-root": "dokion.registry-root.v1.schema.json",
    "registry-index": "dokion.registry-index.v1.schema.json",
    "package-manifest": "dokion.package-manifest.v1.schema.json",
    "registry-config": "dokion.registry-config.v1.schema.json",
    "playbooks-lock": "dokion.playbooks-lock.v1.schema.json",
    "provenance": "dokion.provenance.v1.schema.json",
}


@dataclass(frozen=True)
class ProtocolError:
    path: str
    keyword: str
    message: str


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


def json_pointer(parts: Iterable[object]) -> str:
    encoded = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "" if not encoded else "/" + "/".join(encoded)


def semantic_errors(schema_name: str, document: dict[str, Any]) -> list[ProtocolError]:
    errors: list[ProtocolError] = []

    if schema_name == "dokion.package-manifest.v1":
        files = document.get("files") if isinstance(document.get("files"), list) else []
        seen_paths: dict[str, int] = {}
        for index, item in enumerate(files):
            if not isinstance(item, dict) or not isinstance(item.get("path"), str):
                continue
            path = item["path"]
            if path in seen_paths:
                errors.append(
                    ProtocolError(
                        path=f"/files/{index}/path",
                        keyword="duplicateFilePath",
                        message=f"Package path {path} duplicates files[{seen_paths[path]}].path.",
                    )
                )
            else:
                seen_paths[path] = index

        for field in ("playbook_path", "readme_path", "license_path"):
            declared_path = document.get(field)
            if isinstance(declared_path, str) and declared_path not in seen_paths:
                errors.append(
                    ProtocolError(
                        path=f"/{field}",
                        keyword="declaredPathMissing",
                        message=f"{field} must reference a payload file listed in files[].path.",
                    )
                )

    if schema_name == "dokion.registry-config.v1":
        sources = document.get("sources") if isinstance(document.get("sources"), list) else []
        seen_names: dict[str, int] = {}
        seen_ids: dict[str, int] = {}
        for index, source in enumerate(sources):
            if not isinstance(source, dict):
                continue
            name = source.get("name")
            if isinstance(name, str):
                if name in seen_names:
                    errors.append(
                        ProtocolError(
                            path=f"/sources/{index}/name",
                            keyword="duplicateSourceName",
                            message=f"Registry source name {name} duplicates sources[{seen_names[name]}].name.",
                        )
                    )
                else:
                    seen_names[name] = index
            source_id = source.get("id")
            if isinstance(source_id, str):
                if source_id in seen_ids:
                    errors.append(
                        ProtocolError(
                            path=f"/sources/{index}/id",
                            keyword="duplicateSourceId",
                            message=f"Registry source ID {source_id} duplicates sources[{seen_ids[source_id]}].id.",
                        )
                    )
                else:
                    seen_ids[source_id] = index

    if schema_name == "dokion.provenance.v1":
        for field in ("manifest", "artifact"):
            observation = document.get(field)
            if not isinstance(observation, dict):
                continue
            expected = observation.get("expected_digest")
            observed = observation.get("observed_digest")
            state = observation.get("integrity_state")
            if state == "MATCH" and expected != observed:
                errors.append(
                    ProtocolError(
                        path=f"/{field}/integrity_state",
                        keyword="integrityStateMismatch",
                        message=f"{field}.integrity_state cannot be MATCH when digests differ.",
                    )
                )
            if state == "MISMATCH" and expected == observed:
                errors.append(
                    ProtocolError(
                        path=f"/{field}/integrity_state",
                        keyword="integrityStateMismatch",
                        message=f"{field}.integrity_state cannot be MISMATCH when digests are equal.",
                    )
                )

    return errors


def flatten_validation_error(error: ValidationError) -> Iterator[ValidationError]:
    """Yield wrapper errors and their nested branch causes.

    JSON Schema combinators such as oneOf expose the useful path and keyword in
    ValidationError.context. Keeping only the wrapper would let a fixture pass
    for the wrong reason.
    """
    yield error
    for child in error.context:
        yield from flatten_validation_error(child)


def schema_errors(
    validator: Draft202012Validator,
    document: dict[str, Any],
) -> list[ProtocolError]:
    observed: dict[tuple[str, str, str], ProtocolError] = {}
    for root_error in validator.iter_errors(document):
        for error in flatten_validation_error(root_error):
            protocol_error = ProtocolError(
                path=json_pointer(error.absolute_path),
                keyword=str(error.validator),
                message=error.message,
            )
            observed[(protocol_error.path, protocol_error.keyword, protocol_error.message)] = protocol_error
    return list(observed.values())


def main() -> int:
    schema_paths = sorted(ROOT.glob("*.schema.json"))
    if not schema_paths:
        print("No Registry schemas found", file=sys.stderr)
        return 1

    schemas = {path.name: load_json(path) for path in schema_paths}
    resources: list[tuple[str, Resource[dict[str, Any]]]] = []

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
        if any(existing_id == schema_id for existing_id, _ in resources):
            print(f"DUPLICATE $id: {schema_id}", file=sys.stderr)
            return 1
        resources.append((schema_id, Resource.from_contents(schema)))

    registry = Registry().with_resources(resources)
    failures: list[str] = []

    for fixture_path in sorted(VALID_FIXTURES.glob("*.json")):
        schema_file = fixture_contract(fixture_path)
        schema = schemas[schema_file]
        schema_name = str(schema["properties"]["schema"]["const"])
        validator = Draft202012Validator(schema, registry=registry, format_checker=FormatChecker())
        document = load_json(fixture_path)
        errors = schema_errors(validator, document) + semantic_errors(schema_name, document)
        if errors:
            rendered = "; ".join(f"{error.path or '/'} [{error.keyword}] {error.message}" for error in errors)
            failures.append(f"VALID fixture rejected: {fixture_path.name}: {rendered}")

    expectations = load_json(EXPECTATIONS_PATH)
    invalid_paths = {path.name for path in INVALID_FIXTURES.glob("*.json")}
    expectation_paths = set(expectations)
    if invalid_paths != expectation_paths:
        missing = sorted(invalid_paths - expectation_paths)
        stale = sorted(expectation_paths - invalid_paths)
        failures.append(f"Invalid fixture expectation mismatch: missing={missing}, stale={stale}")

    for fixture_path in sorted(INVALID_FIXTURES.glob("*.json")):
        expectation = expectations.get(fixture_path.name)
        if not isinstance(expectation, dict):
            continue
        schema_name = expectation.get("schema")
        expected_path = expectation.get("path")
        expected_keyword = expectation.get("keyword")
        if not all(isinstance(value, str) for value in (schema_name, expected_path, expected_keyword)):
            failures.append(f"Invalid expectation entry: {fixture_path.name}")
            continue

        schema_file = f"{schema_name}.schema.json"
        schema = schemas.get(schema_file)
        if schema is None:
            failures.append(f"Unknown schema in expectation: {fixture_path.name}: {schema_name}")
            continue

        validator = Draft202012Validator(schema, registry=registry, format_checker=FormatChecker())
        document = load_json(fixture_path)
        errors = schema_errors(validator, document) + semantic_errors(schema_name, document)
        matched = any(error.path == expected_path and error.keyword == expected_keyword for error in errors)
        if not matched:
            rendered = "; ".join(f"{error.path or '/'} [{error.keyword}] {error.message}" for error in errors)
            failures.append(
                f"INVALID fixture missed intended cause: {fixture_path.name}: "
                f"expected {expected_path or '/'} [{expected_keyword}], observed {rendered or 'no errors'}"
            )

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
