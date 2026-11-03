/**
 * Helpers shared by the engine tools. Not a tool itself.
 * Engines are Python scripts with a MANIFEST dict and `def run(input_data, context=None)`.
 */
import { getEngineInitialCode } from '../../components/Engines/EnginesPage';
import { BUILT_IN_ENGINE_IDS } from '../../utils/engineUtils';

export const ENGINE_SERVER = 'http://127.0.0.1:8001';
export const BUILTIN_ENGINES = BUILT_IN_ENGINE_IDS;
export const ENGINE_ID_PATTERN = /^[a-z][a-z0-9_]{2,39}$/;

export async function postJson(path, body, timeoutMs) {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${ENGINE_SERVER}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { httpStatus: res.status, data };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Syntax + shape check on the Python server. Returns null when valid, else an {error, line} object. */
export async function validateCode(code) {
  try {
    const { data } = await postJson('/api/engines/validate', { code }, 10000);
    if (data.valid) return null;
    return { error: data.error || 'Engine code is invalid', line: data.line, problems: data.problems };
  } catch {
    return { error: 'Could not reach the engine server at 127.0.0.1:8001 to validate the code' };
  }
}

export function engineExists(ctx, engineId) {
  return Boolean(engineId) && (ctx.engines.includes(engineId) || Boolean(ctx.enginesData[engineId]));
}

export function resolveCode(ctx, engineId) {
  return ctx.enginesData[engineId]?.code || getEngineInitialCode(engineId, ctx.enginesData) || '';
}
