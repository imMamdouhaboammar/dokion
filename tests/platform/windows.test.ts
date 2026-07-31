import { describe, test, expect } from "bun:test";
import { canonicalizeWindowsPath, formatWindowsLineEndings } from "../../src/execution/windows/path";

describe("PROD-006 Windows Platform Compatibility", () => {
  test("canonicalizes Windows backslashes, drive letters, and CRLF line endings", () => {
    const rawPath = "C:\\Users\\Dokion\\Project\\..\\src\\index.ts";
    const canonical = canonicalizeWindowsPath(rawPath);
    expect(canonical).toBe("C:/Users/Dokion/src/index.ts");

    const crlfText = "line1\r\nline2\r\n";
    const normalized = formatWindowsLineEndings(crlfText, "LF");
    expect(normalized).toBe("line1\nline2\n");
  });
});
