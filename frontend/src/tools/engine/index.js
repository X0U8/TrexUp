/**
 * The engine tools, one file per tool: its DEFINITION (what the model sees) and
 * run(ctx, args) (what happens when the model calls it).
 *
 *     definitions()                          // the tool schemas to offer the model
 *     result = await runEngineTool(ctx, name, args)
 *
 * ctx is {engines, enginesData}. A result is what the model sees next. A refused call
 * comes back as {error} so the model can correct itself. A call that changes engines also
 * carries updatedEngines / updatedEnginesData for the caller to persist.
 */
import * as list_engines from './list_engines';
import * as get_engine from './get_engine';
import * as create_engine from './create_engine';
import * as update_engine from './update_engine';
import * as test_engine from './test_engine';

export { ENGINE_INSTRUCTIONS } from './engineInstructions';

export const MODULES = Object.fromEntries(
  [list_engines, get_engine, create_engine, update_engine, test_engine].map((m) => [m.DEFINITION.name, m])
);
export const ENGINE_TOOL_NAMES = Object.keys(MODULES);
export const ENGINE_TOOL_DEFINITIONS = ENGINE_TOOL_NAMES.map((name) => MODULES[name].DEFINITION);

export function definitions() {
  return ENGINE_TOOL_DEFINITIONS;
}

export async function runEngineTool(ctx, name, args) {
  if (!MODULES[name]) return { error: `unknown tool: ${JSON.stringify(name)}` };
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { error: 'tool arguments must be a JSON object' };
  }
  const safeCtx = { engines: ctx?.engines || [], enginesData: ctx?.enginesData || {} };
  try {
    const result = await MODULES[name].run(safeCtx, args);
    return result && typeof result === 'object' ? result : { result };
  } catch (error) {
    // the model reads the error and tries again
    return { error: error?.message || 'tool failed' };
  }
}
