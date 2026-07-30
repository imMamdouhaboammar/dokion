export interface ScopeValidationResult {
  allowed: boolean;
  violations: string[];
}

export function validateFileScope(
  modifiedFiles: string[],
  allowedScopes: string[]
): ScopeValidationResult {
  const violations: string[] = [];

  if (allowedScopes.length === 0) {
    return { allowed: true, violations: [] }; // No specific scope restrictions
  }

  for (const file of modifiedFiles) {
    const isAllowed = allowedScopes.some((scope) => {
      if (scope === file) return true;
      if (scope.endsWith('/') && file.startsWith(scope)) return true;
      if (scope.startsWith('*') && file.endsWith(scope.slice(1))) return true;
      return false;
    });

    if (!isAllowed) {
      violations.push(`File ${file} modified outside allowed write scopes [${allowedScopes.join(', ')}]`);
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}
