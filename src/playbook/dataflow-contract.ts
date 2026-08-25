export interface DataflowContractIssue {
  message: string;
  instancePath: string;
  schemaPath: string;
}

interface TypedOutput {
  name: string;
  kind: string;
  path: string;
}

interface StepEntry {
  id: string;
  value: Record<string, unknown>;
  path: string;
  order: number;
  outputs: Map<string, TypedOutput>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(message: string, instancePath: string, schemaPath: string): DataflowContractIssue {
  return { message, instancePath, schemaPath };
}

function indexSteps(data: Record<string, unknown>, issues: DataflowContractIssue[]): StepEntry[] {
  const indexed: StepEntry[] = [];
  const stages = Array.isArray(data.stages) ? data.stages : [];

  for (const [stageIndex, stageValue] of stages.entries()) {
    if (!isRecord(stageValue)) continue;
    const steps = Array.isArray(stageValue.steps) ? stageValue.steps : [];

    for (const [stepIndex, stepValue] of steps.entries()) {
      if (!isRecord(stepValue) || typeof stepValue.id !== "string") continue;
      const stepPath = `/stages/${stageIndex}/steps/${stepIndex}`;
      const outputs = new Map<string, TypedOutput>();
      const declaredOutputs = Array.isArray(stepValue.outputs) ? stepValue.outputs : [];

      for (const [outputIndex, outputValue] of declaredOutputs.entries()) {
        if (!isRecord(outputValue) || typeof outputValue.name !== "string" || typeof outputValue.kind !== "string") continue;
        const outputPath = `${stepPath}/outputs/${outputIndex}`;
        if (outputs.has(outputValue.name)) {
          issues.push(issue(
            `step ${stepValue.id} declares duplicate typed output ${outputValue.name}`,
            `${outputPath}/name`,
            "#/dataflow/unique-output-name"
          ));
          continue;
        }
        outputs.set(outputValue.name, {
          name: outputValue.name,
          kind: outputValue.kind,
          path: outputPath
        });
      }

      indexed.push({
        id: stepValue.id,
        value: stepValue,
        path: stepPath,
        order: indexed.length,
        outputs
      });
    }
  }

  return indexed;
}

export function validatePlaybookDataflow(data: unknown): DataflowContractIssue[] {
  if (!isRecord(data)) return [];

  const issues: DataflowContractIssue[] = [];
  const steps = indexSteps(data, issues);
  const stepsById = new Map(steps.map((step) => [step.id, step]));

  for (const step of steps) {
    const declaredInputs = Array.isArray(step.value.inputs) ? step.value.inputs : [];
    const dependencies = new Set(
      Array.isArray(step.value.depends_on)
        ? step.value.depends_on.filter((value): value is string => typeof value === "string")
        : []
    );

    for (const [inputIndex, inputValue] of declaredInputs.entries()) {
      if (!isRecord(inputValue) || !isRecord(inputValue.from)) continue;
      const sourceStepId = inputValue.from.step;
      const sourceOutputName = inputValue.from.output;
      const inputKind = inputValue.kind;
      if (typeof sourceStepId !== "string" || typeof sourceOutputName !== "string" || typeof inputKind !== "string") continue;

      const inputPath = `${step.path}/inputs/${inputIndex}`;
      const producer = stepsById.get(sourceStepId);
      if (!producer) {
        issues.push(issue(
          `typed input references undeclared producer step ${sourceStepId}`,
          `${inputPath}/from/step`,
          "#/dataflow/declared-producer"
        ));
        continue;
      }

      if (producer.id === step.id) {
        issues.push(issue(
          `typed input cannot reference its own consumer step ${step.id}`,
          `${inputPath}/from/step`,
          "#/dataflow/producer-precedes-consumer"
        ));
        continue;
      }

      if (producer.order >= step.order) {
        issues.push(issue(
          `typed input producer ${sourceStepId} must be declared before consumer ${step.id}`,
          `${inputPath}/from/step`,
          "#/dataflow/producer-precedes-consumer"
        ));
        continue;
      }

      if (!dependencies.has(sourceStepId)) {
        issues.push(issue(
          `typed input from ${sourceStepId} requires ${sourceStepId} in depends_on`,
          inputPath,
          "#/dataflow/explicit-dependency"
        ));
      }

      const producerOutput = producer.outputs.get(sourceOutputName);
      if (!producerOutput) {
        issues.push(issue(
          `typed input references undeclared output ${sourceStepId}.${sourceOutputName}`,
          `${inputPath}/from/output`,
          "#/dataflow/declared-output"
        ));
        continue;
      }

      if (producerOutput.kind !== inputKind) {
        issues.push(issue(
          `typed input kind ${inputKind} does not match producer output kind ${producerOutput.kind} for ${sourceStepId}.${sourceOutputName}`,
          `${inputPath}/kind`,
          "#/dataflow/kind-match"
        ));
      }
    }
  }

  return issues;
}
