import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ErrorObject } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { validateRegistryDocumentSemantics } from "../../src/registry/protocol-semantics.ts";

const repositoryRoot = join(import.meta.dir, "../..");
const registrySchemaRoot = join(repositoryRoot, "schemas/registry");
const validFixtureRoot = join(registrySchemaRoot, "fixtures/valid");
const invalidFixtureRoot = join(registrySchemaRoot, "fixtures/invalid");

const contracts = [
  ["dokion.registry-root.v1", "dokion.registry-root.v1.schema.json", "registry-root.json"],
  ["dokion.registry-index.v1", "dokion.registry-index.v1.schema.json", "registry-index.json"],
  ["dokion.package-manifest.v1", "dokion.package-manifest.v1.schema.json", "package-manifest.json"],
  ["dokion.registry-config.v1", "dokion.registry-config.v1.schema.json", "registry-config.json"],
  ["dokion.playbooks-lock.v1", "dokion.playbooks-lock.v1.schema.json", "playbooks-lock.json"],
  ["dokion.provenance.v1", "dokion.provenance.v1.schema.json", "provenance.json"]
] as const;

const authorityFields = [
  "selection_authority",
  "substitution_authority",
  "installation_authority",
  "activation_authority",
  "execution_authority"
] as const;

interface InvalidFixtureExpectation {
  schema: string;
  path: string;
  keyword: string;
}

interface ObservedProtocolError {
  path: string;
  keyword: string;
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function buildValidator(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);

  const commonPath = join(registrySchemaRoot, "common.schema.json");
  expect(existsSync(commonPath)).toBe(true);
  ajv.addSchema(loadJson(commonPath));

  for (const [, schemaFile] of contracts) {
    const schemaPath = join(registrySchemaRoot, schemaFile);
    expect(existsSync(schemaPath)).toBe(true);
    ajv.addSchema(loadJson(schemaPath));
  }

  return ajv;
}

function schemaErrors(errors: ErrorObject[] | null | undefined): ObservedProtocolError[] {
  return (errors ?? []).map((error) => ({ path: error.instancePath, keyword: error.keyword }));
}

describe("Registry protocol schema inventory", () => {
  test("ships six exact v1 contracts with fail-closed top-level objects", () => {
    for (const [schemaName, schemaFile] of contracts) {
      const schemaPath = join(registrySchemaRoot, schemaFile);
      expect(existsSync(schemaPath)).toBe(true);
      const schema = loadJson(schemaPath);

      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(schema.$id).toBe(`https://schemas.dokion.dev/${schemaName}.schema.json`);
      expect(schema.type).toBe("object");
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties).toBeObject();
      expect((schema.properties as Record<string, unknown>).schema).toEqual({ const: schemaName });
      expect(schema.required).toContain("schema");
    }
  });

  test("validates every positive fixture with schema and semantic checks", () => {
    const ajv = buildValidator();
    const fixtureFiles = readdirSync(validFixtureRoot).filter((file) => file.endsWith(".json")).sort();

    for (const fixtureFile of fixtureFiles) {
      const fixture = loadJson(join(validFixtureRoot, fixtureFile));
      const schemaName = fixture.schema;
      expect(typeof schemaName).toBe("string");
      const validate = ajv.getSchema(`https://schemas.dokion.dev/${String(schemaName)}.schema.json`);
      expect(validate).toBeDefined();

      const valid = validate?.(fixture);
      expect(valid, `${fixtureFile}: ${JSON.stringify(validate?.errors ?? [], null, 2)}`).toBe(true);
      expect(validateRegistryDocumentSemantics(String(schemaName), fixture), fixtureFile).toEqual([]);
    }
  });

  test("keeps artifact integrity outside the package manifest to avoid circular digests", () => {
    const schema = loadJson(join(registrySchemaRoot, "dokion.package-manifest.v1.schema.json"));
    const properties = schema.properties as Record<string, unknown>;
    const required = schema.required as string[];
    const fixture = loadJson(join(validFixtureRoot, "package-manifest.json"));
    const files = fixture.files as Array<{ path: string }>;

    expect(properties.artifact).toBeUndefined();
    expect(required).not.toContain("artifact");
    expect(properties.package_format).toEqual({ const: "dokion-package-tar-v1" });
    expect(files.map((file) => file.path)).not.toContain("manifest.json");
  });

  test("rejects every negative fixture for its intended path and keyword", () => {
    const ajv = buildValidator();
    const expectations = loadJson(join(registrySchemaRoot, "invalid-fixture-expectations.json")) as Record<
      string,
      InvalidFixtureExpectation
    >;
    const invalidFiles = readdirSync(invalidFixtureRoot).filter((file) => file.endsWith(".json")).sort();

    expect(Object.keys(expectations).sort()).toEqual(invalidFiles);

    for (const fixtureFile of invalidFiles) {
      const expectation = expectations[fixtureFile];
      expect(expectation).toBeDefined();
      const fixture = loadJson(join(invalidFixtureRoot, fixtureFile));
      const validate = ajv.getSchema(`https://schemas.dokion.dev/${expectation!.schema}.schema.json`);
      expect(validate).toBeDefined();
      validate?.(fixture);

      const observed: ObservedProtocolError[] = [
        ...schemaErrors(validate?.errors),
        ...validateRegistryDocumentSemantics(expectation!.schema, fixture).map((error) => ({
          path: error.path,
          keyword: error.keyword
        }))
      ];

      expect(observed, fixtureFile).toContainEqual({
        path: expectation!.path,
        keyword: expectation!.keyword
      });
    }
  });

  test("rejects every authority field when mutated to true across all contracts", () => {
    const ajv = buildValidator();
    const common = loadJson(join(registrySchemaRoot, "common.schema.json"));
    const authorityDefinition = ((common.$defs as Record<string, unknown>).authorityNone as Record<string, unknown>);
    const authorityProperties = authorityDefinition.properties as Record<string, { const: boolean }>;

    for (const field of authorityFields) {
      expect(authorityProperties[field]).toEqual({ const: false });
    }

    for (const [schemaName, , fixtureFile] of contracts) {
      const fixture = loadJson(join(validFixtureRoot, fixtureFile));
      const validate = ajv.getSchema(`https://schemas.dokion.dev/${schemaName}.schema.json`);
      expect(validate).toBeDefined();

      for (const field of authorityFields) {
        const mutated = structuredClone(fixture);
        (mutated.authority as Record<string, boolean>)[field] = true;
        expect(validate?.(mutated), `${schemaName}: ${field}`).toBe(false);
      }
    }
  });

  test("enforces SemVer numeric prerelease rules", () => {
    const ajv = buildValidator();
    const validate = ajv.compile({ $ref: "https://schemas.dokion.dev/common.schema.json#/$defs/exactSemver" });

    expect(validate("1.2.3")).toBe(true);
    expect(validate("1.2.3-0")).toBe(true);
    expect(validate("1.2.3-alpha.1")).toBe(true);
    expect(validate("1.2.3+build.01")).toBe(true);
    expect(validate("1.2.3-01")).toBe(false);
    expect(validate("1.2.3-alpha.01")).toBe(false);
  });

  test("forbids ambiguous trust fields and synthetic marketplace metrics", () => {
    for (const [, schemaFile] of contracts) {
      const source = readFileSync(join(registrySchemaRoot, schemaFile), "utf8");
      expect(source).not.toMatch(/"verified"\s*:/);
      expect(source).not.toContain("download_count");
      expect(source).not.toContain("rating");
      expect(source).not.toContain("success_rate");
      expect(source).not.toContain("trust_score");
    }
  });
});
