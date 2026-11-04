/** test_engine: run an engine on sample input. Returns the output, or the error with line and traceback. */
import { engineExists, postJson, resolveCode } from './_shared';

const DEFAULT_TIMEOUT_S = 60;
const MAX_TIMEOUT_S = 120;

export const DEFINITION = {
  type: 'function',
  name: 'test_engine',
  description:
    'Run an engine on sample input_data and return its output, or the error with line number and traceback. Subject to a timeout (default 60s); engines run unsandboxed on the local server.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      engine_id: { type: 'string', description: 'The unique ID of the engine to run.' },
      input_data: {
        type: 'object',
        description:
          'Sample dictionary passed to run(input_data, context=None). Keys must match the input ports declared in the engine MANIFEST["inputs"].',
      },
      timeout_seconds: { type: 'number', description: 'Optional timeout in seconds (default 60, max 120).' },
    },
    required: ['engine_id', 'input_data'],
  },
};

function lastTracebackLine(traceback) {
  const hits = [...String(traceback || '').matchAll(/File "<string>", line (\d+)/g)];
  return hits.length ? Number(hits[hits.length - 1][1]) : undefined;
}

export async function run(ctx, args) {
  const id = String(args.engine_id || '').trim();
  if (!id) return { error: 'engine_id is required' };
  if (!engineExists(ctx, id)) return { error: `Engine "${id}" not found. Call list_engines to see available engines.` };

  const requested = Number(args.timeout_seconds);
  const timeoutS = Math.min(Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_TIMEOUT_S, MAX_TIMEOUT_S);
  const start = performance.now();
  try {
    const { httpStatus, data } = await postJson(
      '/api/engines/run',
      { code: resolveCode(ctx, id), input_data: args.input_data || {} },
      timeoutS * 1000
    );
    const elapsed = Math.round(performance.now() - start);
    if (httpStatus === 200 && data.status === 'success') {
      return { tested: true, engine_id: id, output: data.output, duration_ms: data.duration_ms || elapsed };
    }
    return {
      error: data.error || `Engine failed with HTTP ${httpStatus}`,
      tested: true,
      engine_id: id,
      line: lastTracebackLine(data.traceback),
      traceback: data.traceback,
      output: data.output,
      duration_ms: data.duration_ms || elapsed,
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      return {
        error: `Engine did not finish within ${timeoutS}s. Simplify it or test with a smaller input. The local server may still be busy finishing this run.`,
        tested: true,
        engine_id: id,
        timed_out: true,
      };
    }
    throw new Error('Could not reach the engine server at 127.0.0.1:8001');
  }
}
