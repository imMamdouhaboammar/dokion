import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = join(import.meta.dir, "../..");
const registrySchemaRoot = join(repositoryRoot, "schemas/registry");

const contracts = [
  ["dokion.registry-root.v1", "dokion.registry-root.v1.schema.json", "registry-root.json"],
  ["dokion.registry-index.v1", "dokion.registry-index.v1.schema.json", "registry-index.json"],
  ["dokion.package-manifest.v1", "dokion.package-manifest.v1.schema.json", "package-manifest.json"],
  ["dokion.registry-config.v1", "dokion.registry-config.v1.schema.json", "registry-config.json"],
  ["dokion.playbooks-lock.v1", "dokion.playbooks-lock.v1.schema.json", "playbooks-lock.json"],
  ["dokion.provenance.v1", "dokion.provenance.v1.schema.json", "provenance.json"]
] as const;

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

  test("validates the canonical positive fixture for every contract", () => {
    const ajv = buildValidator();

    for (const [schemaName, , fixtureFile] of contracts) {
      const fixturePath = join(registrySchemaRoot, "fixtures/valid", fixtureFile);
      expect(existsSync(fixturePath)).toBe(true);
      const validate = ajv.getSchema(`https://schemas.dokion.dev/${schemaName}.schema.json`);
      expect(validate).toBeDefined();

      const valid = validate?.(loadJson(fixturePath));
      expect(valid, JSON.stringify(validate?.errors ?? [], null, 2)).toBe(true);
    }
  });

  test("keeps artifact integrity outside the package manifest to avoid circular digests", () => {
    const schema = loadJson(join(registrySchemaRoot, "dokion.package-manifest.v1.schema.json"));
    const properties = schema.properties as Record<string, unknown>;
    const required = schema.required as string[];
    const fixture = loadJson(join(registrySchemaRoot, "fixtures/valid/package-manifest.json"));
    const files = fixture.files as Array<{ path: string }>;

    expect(properties.artifact).toBeUndefined();
    expect(required).not.toContain("artifact");
    expect(properties.package_format).toEqual({ const: "dokion-package-tar-v1" });
    expect(files.map((file) => file.path)).not.toContain("manifest.json");
  });

  test("rejects every shipped negative fixture", () => {
    const ajv = buildValidator();
    const invalidFixtures = [
      ["dokion.registry-root.v1", "registry-root-authority.json"],
      ["dokion.registry-index.v1", "registry-index-mutable-git.json"],
      ["dokion.package-manifest.v1", "package-manifest-path-traversal.json"],
      ["dokion.package-manifest.v1", "package-manifest-self-reference.json"],
      ["dokion.registry-config.v1", "registry-config-credentials.json"],
      ["dokion.playbooks-lock.v1", "playbooks-lock-floating-version.json"],
      ["dokion.provenance.v1", "provenance-ambiguous-verified.json"]
    ] as const;

    for (const [schemaName, fixtureFile] of invalidFixtures) {
      const fixturePath = join(registrySchemaRoot, "fixtures/invalid", fixtureFile);
      expect(existsSync(fixturePath)).toBe(true);
      const validate = ajv.getSchema(`https://schemas.dokion.dev/${schemaName}.schema.json`);
      expect(validate).toBeDefined();
      expect(validate?.(loadJson(fixturePath))).toBe(false);
    }
  });

  test("forbids ambiguous trust and execution authority fields in protocol schemas", () => {
    for (const [, schemaFile] of contracts) {
      const source = readFileSync(join(registrySchemaRoot, schemaFile), "utf8");
      expect(source).not.toMatch(/"verified"\s*:/);
      expect(source).not.toMatch(/"execution_authority"\s*:\s*\{(?![^}]*"const"\s*:\s*false)/s);
      expect(source).not.toMatch(/"activation_authority"\s*:\s*\{(?![^}]*"const"\s*:\s*false)/s);
      expect(source).not.toContain("download_count");
      expect(source).not.toContain("rating");
      expect(source).not.toContain("success_rate");
      expect(source).not.toContain("trust_score");
    }
  });
});
