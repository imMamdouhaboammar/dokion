import type { AnySchema } from "ajv";

import capabilityLockSchema from "../../schemas/capability-lock.schema.json";
import coverageAssignmentSchema from "../../schemas/dokion-coverage-assignment.schema.json";
import findingSchema from "../../schemas/dokion-finding.schema.json";
import manifestSchema from "../../schemas/dokion-manifest.schema.json";
import playbookSchema from "../../schemas/dokion-playbook.schema.json";
import stateSchema from "../../schemas/dokion-state.schema.json";

export const embeddedSchemas = {
  manifest: manifestSchema as AnySchema,
  playbook: playbookSchema as AnySchema,
  coverageAssignment: coverageAssignmentSchema as AnySchema,
  state: stateSchema as AnySchema,
  finding: findingSchema as AnySchema,
  capabilityLock: capabilityLockSchema as AnySchema
} as const;
