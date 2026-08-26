import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import requestSchema from "../../schemas/dokion-invocation-request.schema.json";
import receiptSchema from "../../schemas/dokion-invocation-receipt.schema.json";
import { DokionError } from "../core/errors.ts";

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);

const requestValidator = ajv.compile(requestSchema);
const receiptValidator = ajv.compile(receiptSchema);

function assertValid(label: string, validator: ValidateFunction, value: unknown): void {
  if (validator(value)) return;
  throw new DokionError("INVALID_STATE", `Invocation ${label} schema validation failed`, {
    issues: (validator.errors ?? []).map((issue) => ({
      instancePath: issue.instancePath,
      message: issue.message,
      schemaPath: issue.schemaPath
    }))
  });
}

export function assertValidInvocationRequest(value: unknown): void {
  assertValid("request", requestValidator, value);
}

export function assertValidInvocationReceipt(value: unknown): void {
  assertValid("receipt", receiptValidator, value);
}
