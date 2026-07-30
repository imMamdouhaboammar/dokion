import { describe, test, expect } from 'bun:test';
import { spoolCommandStream } from '../../src/execution/spooler';

describe('EXEC-004 Output Spooler', () => {
  test('spools stream and respects byte limit', async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello World Bounded Spooler Output');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const result = await spoolCommandStream(stream, 10);
    expect(result.truncated).toBe(true);
    expect(result.bytesSpooled).toBe(10);
  });
});
