import type { AnySchema } from "ajv";

import capabilityLockSchema from "../../schemas/capability-lock.schema.json";
import coverageAssignmentSchema from "../../schemas/dokion-coverage-assignment.schema.json";
import eventSchema from "../../schemas/dokion-event.schema.json";
import findingSchema from "../../schemas/dokion-finding.schema.json";
import manifestSchema from "../../schemas/dokion-manifest.schema.json";
import playbookSchema from "../../schemas/dokion-playbook.schema.json";
import stateSchema from "../../schemas/dokion-state.schema.json";
import stepInputSchema from "../../schemas/dokion-step-input.schema.json";
import stepOutputSchema from "../../schemas/dokion-step-output.schema.json";

export const embeddedSchemas = {
  manifest: manifestSchema as AnySchema,
  playbook: playbookSchema as AnySchema,
  coverageAssignment: coverageAssignmentSchema as AnySchema,
  stepInput: stepInputSchema as AnySchema,
  stepOutput: stepOutputSchema as AnySchema,
  state: stateSchema as AnySchema,
  event: eventSchema as AnySchema,
  finding: findingSchema as AnySchema,
  capabilityLock: capabilityLockSchema as AnySchema
} as const;
