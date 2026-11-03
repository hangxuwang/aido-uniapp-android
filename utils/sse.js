function normalizeNewlines(text) {
  return (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseEventBlock(block) {
  return block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
}

export function createSseAccumulator() {
  let buffer = '';

  return {
    feed(text) {
      buffer += normalizeNewlines(text);
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      return parts
        .flatMap(parseEventBlock)
        .filter((item) => item && item !== '[DONE]');
    },
    flush() {
      const rest = normalizeNewlines(buffer);
      buffer = '';
      return rest
        .split('\n\n')
        .flatMap(parseEventBlock)
        .filter((item) => item && item !== '[DONE]');
    }
  };
}
