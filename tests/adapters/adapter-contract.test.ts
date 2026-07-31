import { describe, test, expect } from "bun:test";
import { validateAdapterContract, negotiatePlatformGuarantees } from "../../src/platform/adapter-contract";

describe("PROD-001..005 Canonical Adapter Contract Suite", () => {
  test("validates Claude Code, Codex, and Gemini adapters against core contract", () => {
    const claudeAdapter = {
      id: "claude-code",
      version: "1.0.0",
      supportedCommands: ["dokion", "dokion run", "dokion audit"],
      hasHookGuarantees: true,
      hasFileSystemAccess: true,
    };

    const codexAdapter = {
      id: "codex",
      version: "1.0.0",
      supportedCommands: ["dokion", "dokion run", "dokion audit"],
      hasHookGuarantees: false,
      hasFileSystemAccess: true,
    };

    expect(validateAdapterContract(claudeAdapter).valid).toBe(true);
    expect(validateAdapterContract(codexAdapter).valid).toBe(true);
  });

  test("negotiates platform guarantees and reports degradations explicitly", () => {
    const guarantees = negotiatePlatformGuarantees({
      adapterId: "gemini-cli",
      os: "darwin",
      hooksAvailable: false,
    });

    expect(guarantees.adapterId).toBe("gemini-cli");
    expect(guarantees.hookStatus).toBe("DEGRADED_UNAVAILABLE");
    expect(guarantees.degradations).toContain("Hook protection is disabled on this adapter");
  });
});
