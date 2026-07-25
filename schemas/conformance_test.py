#!/usr/bin/env python3
"""Conformance tests for the Dokion spec artifacts.

This validates the SPECIFICATION, not the product. It exists so the central claim in
SPEC.md — that the authority model is mechanically enforced rather than merely documented —
is reproducible by a reader instead of taken on trust.

Two suites:
  POSITIVE  every shipped schema and playbook is valid
  NEGATIVE  the schemas REFUSE each thing the authority model forbids

The negative suite is the one that matters. A schema that accepts everything documents
nothing.

    pip install jsonschema && python3 schemas/conformance_test.py
"""

import copy
import glob
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator as Validator
except ImportError:
    sys.exit("requires: pip install jsonschema")

ROOT = Path(__file__).resolve().parent.parent


def load(rel):
    return json.loads((ROOT / rel).read_text())


def main():
    schemas = {p.name: load(f"schemas/{p.name}") for p in sorted((ROOT / "schemas").glob("*.json"))}
    playbook = Validator(schemas["dokion-playbook.schema.json"])
    lockfile = Validator(schemas["capability-lock.schema.json"])
    manifest = Validator(schemas["dokion-manifest.schema.json"])
    finding = Validator(schemas["dokion-finding.schema.json"])
    base_manifest = load("dokion.json")
    base = load("playbooks/example.playbook.json")
    failures = 0

    print("POSITIVE — shipped artifacts must be valid")
    for name, schema in schemas.items():
        try:
            Validator.check_schema(schema)
            print(f"  ok    schema {name}")
        except Exception as exc:
            failures += 1
            print(f"  FAIL  schema {name}: {exc}")

    errors = list(manifest.iter_errors(base_manifest))
    if errors:
        failures += 1
        print(f"  FAIL  dokion.json: {errors[0].message[:120]}")
    else:
        print("  ok    dokion.json")

    for path in sorted(glob.glob(str(ROOT / "playbooks/**/*.json"), recursive=True)):
        rel = Path(path).relative_to(ROOT)
        errors = list(playbook.iter_errors(json.loads(Path(path).read_text())))
        if errors:
            failures += 1
            print(f"  FAIL  {rel}: {errors[0].message[:120]}")
        else:
            print(f"  ok    {rel}")

    def refuses(label, validator, doc):
        nonlocal failures
        if list(validator.iter_errors(doc)):
            print(f"  ok    refuses: {label}")
        else:
            failures += 1
            print(f"  LEAK  ACCEPTED: {label}")

    def mutate(**changes):
        doc = copy.deepcopy(base)
        doc["authority"].update(changes)
        return doc

    def step_mutate(fn):
        doc = copy.deepcopy(base)
        fn(doc["stages"][0]["steps"][0])
        return doc

    print("\nNEGATIVE — the authority model must be unrepresentable to violate")
    refuses("playbook granting itself automatic installation", playbook,
            mutate(automatic_installation=True))
    refuses("playbook granting itself automatic substitution", playbook,
            mutate(automatic_substitution=True))
    refuses("playbook granting itself automatic reordering", playbook,
            mutate(automatic_reordering=True))
    refuses("playbook granting itself capability discovery", playbook,
            mutate(automatic_capability_discovery=True))
    refuses("playbook handing capability selection to the orchestrator", playbook,
            mutate(capability_selection="ORCHESTRATOR"))
    refuses("playbook handing execution order to the orchestrator", playbook,
            mutate(execution_order="ORCHESTRATOR"))
    refuses("playbook letting recommendations self-apply", playbook,
            mutate(recommendations_require_approval=False))

    refuses("step with no declared responsibility", playbook,
            step_mutate(lambda s: s.pop("responsibility")))
    refuses("step with an invented execution mode", playbook,
            step_mutate(lambda s: s.update(mode="FIX_EVERYTHING")))
    refuses("step with an invented approval policy", playbook,
            step_mutate(lambda s: s.update(approval="SOMETIMES")))
    refuses("step with an invented failure policy", playbook,
            step_mutate(lambda s: s.update(failure_policy="IGNORE")))
    refuses("capability pinned to a floating reference", playbook,
            step_mutate(lambda s: s["capability"].update(immutable_reference="latest")))
    refuses("undeclared field smuggled into a step", playbook,
            step_mutate(lambda s: s.update(sneak_extra_tool="curl")))

    def manifest_mutate(fn):
        doc = copy.deepcopy(base_manifest)
        fn(doc)
        return doc

    refuses("catalog entry shipping default_enabled true", manifest,
            manifest_mutate(lambda d: d["capability_catalog"]["skills"][0].update(default_enabled=True)))
    refuses("catalog entry waiving user approval", manifest,
            manifest_mutate(lambda d: d["capability_catalog"]["skills"][0].update(requires_user_approval=False)))
    refuses("manifest handing capability selection to the orchestrator", manifest,
            manifest_mutate(lambda d: d["authority"].update(selection_owner="ORCHESTRATOR")))
    refuses("manifest handing release gates to the orchestrator", manifest,
            manifest_mutate(lambda d: d["authority"].update(release_gate_owner="ORCHESTRATOR")))
    refuses("manifest dropping 'reorder steps' from forbidden_autonomy", manifest,
            manifest_mutate(lambda d: d["authority"].__setitem__(
                "forbidden_autonomy",
                [x for x in d["authority"]["forbidden_autonomy"] if x != "reorder steps"])))
    refuses("manifest dropping 'install undeclared capability' from forbidden_autonomy", manifest,
            manifest_mutate(lambda d: d["authority"].__setitem__(
                "forbidden_autonomy",
                [x for x in d["authority"]["forbidden_autonomy"] if x != "install undeclared capability"])))
    refuses("loops policy permitting orchestrator reordering", manifest,
            manifest_mutate(lambda d: d["loops"]["execution_policy"].update(orchestrator_may_reorder=True)))
    refuses("loops policy permitting undeclared step execution", manifest,
            manifest_mutate(lambda d: d["loops"]["execution_policy"].update(undeclared_step_execution=True)))
    refuses("recommended profile presented as active configuration", manifest,
            manifest_mutate(lambda d: d["user_approval_checklist"]["recommended_initial_profile"]
                            .update(status="ACTIVE")))
    refuses("readiness score allowed to outrank a critical blocker", manifest,
            manifest_mutate(lambda d: d["release_readiness"].update(critical_blocker_overrides_score=False)))
    refuses("repair policy permitting blind mass fixing", manifest,
            manifest_mutate(lambda d: d["finding_and_evidence_policy"]["repair_policy"]
                            .update(fix_all_findings_blindly=True)))
    refuses("runtime policy auto-committing generated files", manifest,
            manifest_mutate(lambda d: d["runtime_policy"].update(
                generated_files_commit_policy="COMMIT_AUTOMATICALLY")))
    refuses("secrets policy permitting secrets in reports", manifest,
            manifest_mutate(lambda d: d["runtime_policy"]["secrets_policy"].update(
                include_secrets_in_reports=True)))

    refuses("capability lock claiming selection authority", lockfile, {
        "schema_version": 1, "capabilities": [],
        "role": {"selection_authority": True, "substitution_authority": False,
                 "installation_authority": False}})
    refuses("capability lock claiming substitution authority", lockfile, {
        "schema_version": 1, "capabilities": [],
        "role": {"selection_authority": False, "substitution_authority": True,
                 "installation_authority": False}})
    refuses("capability lock claiming installation authority", lockfile, {
        "schema_version": 1, "capabilities": [],
        "role": {"selection_authority": False, "substitution_authority": False,
                 "installation_authority": True}})

    src = {"capability_id": "example-scanner"}
    refuses("finding marked VERIFIED with no evidence", finding, {
        "id": "DK-SEC-001", "step_id": "s", "severity": "HIGH", "title": "t",
        "status": "VERIFIED", "source": src})
    refuses("risk accepted with nobody on the record", finding, {
        "id": "DK-SEC-002", "step_id": "s", "severity": "HIGH", "title": "t",
        "status": "ACCEPTED_RISK", "source": src})
    refuses("finding deferred with nobody on the record", finding, {
        "id": "DK-SEC-003", "step_id": "s", "severity": "HIGH", "title": "t",
        "status": "DEFERRED", "source": src})
    refuses("finding with an invented status", finding, {
        "id": "DK-SEC-004", "step_id": "s", "severity": "HIGH", "title": "t",
        "status": "PROBABLY_FINE", "source": src})
    refuses("finding with no named source capability", finding, {
        "id": "DK-SEC-005", "step_id": "s", "severity": "HIGH", "title": "t",
        "status": "OPEN"})

    print(f"\n{'PASS — all conformance tests hold' if not failures else f'FAIL — {failures} problem(s)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
