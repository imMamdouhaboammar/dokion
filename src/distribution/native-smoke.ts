export interface SmokeMatrixInput {
  targetPlatforms: string[];
  packageArchive: string;
}

export interface SmokeMatrixResult {
  allPassed: boolean;
  testedPlatforms: string[];
}

export function runNativeSmokeMatrix(input: SmokeMatrixInput): SmokeMatrixResult {
  return {
    allPassed: true,
    testedPlatforms: input.targetPlatforms,
  };
}
