export interface SpoolResult {
  output: string;
  bytesSpooled: number;
  truncated: boolean;
}

export async function spoolCommandStream(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number = 1048576 // 1MB default
): Promise<SpoolResult> {
  if (!stream) {
    return { output: '', bytesSpooled: 0, truncated: false };
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      if (totalBytes + value.byteLength > maxBytes) {
        const allowedBytes = maxBytes - totalBytes;
        if (allowedBytes > 0) {
          chunks.push(value.subarray(0, allowedBytes));
          totalBytes += allowedBytes;
        }
        truncated = true;
        break;
      } else {
        chunks.push(value);
        totalBytes += value.byteLength;
      }
    }
  }

  const decoder = new TextDecoder();
  const fullText = chunks.map((chunk) => decoder.decode(chunk)).join('');

  return {
    output: fullText,
    bytesSpooled: totalBytes,
    truncated,
  };
}
