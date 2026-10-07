// Fixed labels and bounded numeric metadata only; never retain upstream messages,
// URLs, IDs, headers, payloads or exception text in the returned diagnostic.
const GATES = new Set(['remote-database', 'remote-worker-bindings', 'remote-worker-domain', 'source-settings', 'source-query']);
const MAX_DIAGNOSTIC_BYTES = 65_536;
async function numericErrorCode(response) {
  let reader;
  try {
    reader = response.clone().body?.getReader();
    if (!reader) return undefined;
    const chunks = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_DIAGNOSTIC_BYTES) return undefined;
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    const code = Array.isArray(body?.errors) ? body.errors[0]?.code : undefined;
    if (Number.isSafeInteger(code) && code >= 0 && code <= 999_999) return code;
  } catch {
    // Malformed/unavailable diagnostic metadata must not replace the real gate.
  } finally {
    // Do not await tee cancellation: the original response is still unread.
    if (reader) void reader.cancel().catch(() => {});
  }
}
export function createPreflightReporter(fetcher) {
  let last;
  return {
    forGate(gate) {
      if (!GATES.has(gate)) throw Error('Unknown preflight gate');
      return async (...args) => {
        last = { gate, status: undefined, code: undefined };
        const response = await fetcher(...args);
        if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) last.status = response.status;
        last.code = await numericErrorCode(response);
        return response;
      };
    },
    identityFailure(reason) {
      if (last?.gate === 'remote-database' && ['identity-envelope', 'identity-uuid', 'identity-name'].includes(reason)) last.reason = reason;
    },
    summary() {
      return last ? `${last.gate}; HTTP status=${last.status ?? 'none'}; error code=${last.code ?? 'none'}${last.reason ? `; reason=${last.reason}` : ''} (sanitized diagnostics only).` : undefined;
    },
  };
}
