import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PLAYBOOK_SCHEMA_PATH = "schemas/dokion-playbook.schema.json";
const STEP_INPUT_SCHEMA_ID = "https://raw.githubusercontent.com/imMamdouhaboammar/dokion/main/schemas/dokion-step-input.schema.json";
const STEP_OUTPUT_SCHEMA_ID = "https://raw.githubusercontent.com/imMamdouhaboammar/dokion/main/schemas/dokion-step-output.schema.json";

interface JsonObject {
  [key: string]: unknown;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(parent: JsonObject, key: string): JsonObject {
  const value = parent[key];
  if (!isObject(value)) throw new Error(`Expected ${key} to be an object in ${PLAYBOOK_SCHEMA_PATH}`);
  return value;
}

function synchronizedProperties(): { inputs: JsonObject; outputs: JsonObject } {
  return {
    inputs: {
      type: "array",
      items: {
        oneOf: [
          { type: "string" },
          { $ref: STEP_INPUT_SCHEMA_ID }
        ]
      },
      description: "Declared inputs. Legacy string names remain accepted during migration; typed bindings must identify an exact producer step and output and are semantically validated before execution."
    },
    outputs: {
      type: "array",
      items: {
        oneOf: [
          { type: "string" },
          { $ref: STEP_OUTPUT_SCHEMA_ID }
        ]
      },
      description: "Declared outputs. Legacy string names remain accepted during migration; typed declarations define the artifact contract available to later steps."
    }
  };
}

export function synchronizePlaybookDataflowSchema(schema: unknown): JsonObject {
  if (!isObject(schema)) throw new Error(`${PLAYBOOK_SCHEMA_PATH} must contain a JSON object`);
  const defs = requireObject(schema, "$defs");
  const step = requireObject(defs, "step");
  const properties = requireObject(step, "properties");
  const synchronized = synchronizedProperties();
  properties.inputs = synchronized.inputs;
  properties.outputs = synchronized.outputs;
  return schema;
}

async function main(): Promise<void> {
  const path = join(process.cwd(), PLAYBOOK_SCHEMA_PATH);
  const raw = await readFile(path, "utf8");
  const synchronized = `${JSON.stringify(synchronizePlaybookDataflowSchema(JSON.parse(raw)), null, 2)}\n`;
  const write = process.argv.includes("--write");

  if (write) {
    if (raw !== synchronized) await writeFile(path, synchronized, "utf8");
    return;
  }

  if (raw !== synchronized) {
    console.error(`${PLAYBOOK_SCHEMA_PATH} is out of sync with the typed Playbook dataflow contract`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
