export function canonicalizeWindowsPath(pathStr: string): string {
  let normalized = pathStr.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const resolvedParts: string[] = [];

  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (resolvedParts.length > 0) {
        resolvedParts.pop();
      }
    } else {
      resolvedParts.push(part);
    }
  }

  if (parts[0] && parts[0].includes(":")) {
    return `${parts[0]}/${resolvedParts.slice(1).join("/")}`;
  }

  return resolvedParts.join("/");
}

export function formatWindowsLineEndings(content: string, targetEnding: "LF" | "CRLF"): string {
  const lfContent = content.replace(/\r\n/g, "\n");
  if (targetEnding === "LF") {
    return lfContent;
  }
  return lfContent.replace(/\n/g, "\r\n");
}
