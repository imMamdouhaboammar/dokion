import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { DokionError } from "../core/errors.ts";
import { validateRegistryDocumentSemantics } from "./protocol-semantics.ts";

interface CompiledRegistrySchemas {
  validators: Map<string, ValidateFunction>;
}

const cache = new Map<string, Promise<CompiledRegistrySchemas>>();

async function compileRegistrySchemas(repositoryRoot: string): Promise<CompiledRegistrySchemas> {
  const schemaRoot = join(repositoryRoot, "schemas", "registry");
  const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);

  const files = (await readdir(schemaRoot)).filter((file) => file.endsWith(".schema.json")).sort();
  for (const file of files) {
    const schema = JSON.parse(await readFile(join(schemaRoot, file), "utf8")) as Record<string, unknown>;
    ajv.addSchema(schema);
  }

  const validators = new Map<string, ValidateFunction>();
  for (const file of files) {
    if (file === "common.schema.json") continue;
    const schemaName = file.slice(0, -".schema.json".length);
    const validator = ajv.getSchema(`https://schemas.dokion.dev/${file}`);
    if (!validator) {
      throw new DokionError("PACKAGE_MANIFEST_INVALID", "Registry protocol schema could not be compiled", {
        schemaName,
        file
      });
    }
    validators.set(schemaName, validator);
  }
  return { validators };
}

function errorDetails(error: ErrorObject): Record<string, unknown> {
  return {
    path: error.instancePath,
    keyword: error.keyword,
    message: error.message,
    params: error.params
  };
}

export async function validateRegistryProtocolDocument(
  repositoryRoot: string,
  schemaName: string,
  document: unknown
): Promise<void> {
  const compiled = await (cache.get(repositoryRoot) ?? (() => {
    const promise = compileRegistrySchemas(repositoryRoot);
    cache.set(repositoryRoot, promise);
    return promise;
  })());
  const validator = compiled.validators.get(schemaName);
  if (!validator) {
    throw new DokionError("PACKAGE_MANIFEST_INVALID", "Unknown Registry protocol schema", { schemaName });
  }

  if (!validator(document)) {
    throw new DokionError("PACKAGE_MANIFEST_INVALID", "Registry protocol document failed structural validation", {
      schemaName,
      issues: (validator.errors ?? []).map(errorDetails)
    });
  }

  const semanticIssues = validateRegistryDocumentSemantics(schemaName, document);
  if (semanticIssues.length > 0) {
    throw new DokionError("PACKAGE_MANIFEST_INVALID", "Registry protocol document failed semantic validation", {
      schemaName,
      issues: semanticIssues
    });
  }
}
